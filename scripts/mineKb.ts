#!/usr/bin/env tsx
/**
 * KB mining CLI (PRD #177). Reads a folder of LINE OA chat-history CSV exports
 * for one project, mines candidate intents, annotates each with sensitivity +
 * policy + a Thai name, prints a full summary, and — only on an explicit
 * `--apply` — inserts each new candidate as a `draft` row in
 * `crm_bot_knowledge_base` (M4, issue #181).
 *
 * Usage:
 *   npx tsx scripts/mineKb.ts --dir <folder> --project <code>            # dry-run
 *   npx tsx scripts/mineKb.ts --dir <folder> --project <code> --apply    # insert
 *   npx tsx scripts/mineKb.ts ... --out <file.json>                      # artifact path
 *
 * SAFETY: default is DRY-RUN — no DB write happens without `--apply`. `.env`
 * `DATABASE_URL` points at PRODUCTION; only run `--apply` when you mean it.
 *
 * The CSV history lives OUTSIDE the repo (~/workspaces/flexio/fixlo-crm-history/
 * <project>/, gitignored — PII + passwords). Input is read through a small
 * source seam (CsvSource, §"Input-source seam" below) so a `crm_chat_messages`
 * DB source can plug in later with NO change to the mining/insert logic. Nothing
 * raw (PII/passwords) is printed: only aggregate counts, over already-scrubbed
 * text. Mined drafts embed NULL — n8n embeds them when a supervisor approves in
 * the KB review screen (S6); nothing is live until approved (ADR 0002/0005).
 */

import fs from "fs";
import os from "os";
import path from "path";
import { parseChatCsv, type SenderType } from "../src/lib/crmChatCsvParse";
import {
  mineIntentCandidates,
  type IntentCandidate,
} from "../src/lib/crmKbMiner";
import { annotateCandidate } from "../src/lib/crmSensitivityHeuristic";
import type { ResponsePolicy } from "../src/lib/crmIntentPolicy";
import { crmReplyNormalize } from "../src/lib/crmReplyNormalize";
import {
  candidateToDraftRow,
  partitionNewCandidates,
  type AnnotatedCandidate,
  type CandidatePartition,
  type KbDraftRow,
} from "../src/lib/crmKbInsert";

/** CRM default session gap (6h); see docs/crm/CONTEXT.md and ADR 0003. */
const GAP_MINUTES = 360;

/** A named CSV blob to mine. `name` is for logging only (never its contents). */
export interface CsvInput {
  name: string;
  text: string;
}

/**
 * INPUT-SOURCE SEAM (issue #181). The mining + insert pipeline consumes chat
 * history ONLY through this function type — one blob of chat text per
 * conversation (one customer). Everything downstream (`countBySender`,
 * `mineCandidates`, annotation, partition, insert) is written against
 * `CsvSource`, never against the filesystem, so a future source that reads
 * `crm_chat_messages` from the DB — grouping rows by `(project_id, user_id)` and
 * emitting one `CsvInput`-shaped blob per customer — plugs in here with NO change
 * to the mining or insert logic. `dirCsvSource` is today's only implementation;
 * a `crmChatMessagesSource(projectId)` is the intended next one (not built yet).
 */
export type CsvSource = () => CsvInput[] | Promise<CsvInput[]>;

/** Filesystem source: every `*.csv` directly under `dir`. */
export function dirCsvSource(dir: string): CsvSource {
  return () => {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".csv"))
      .sort();
    return files.map((f) => ({
      name: f,
      text: fs.readFileSync(path.join(dir, f), "utf8"),
    }));
  };
}

export interface MineArgs {
  dir: string;
  project: string;
  /** Explicit confirmation to write to the DB. Default false = dry-run. */
  apply: boolean;
  /** Optional artifact path override; defaults to a path OUTSIDE the repo. */
  out?: string;
}

/** Flag parser for `--dir`, `--project`, `--apply` (confirm gate), `--out`. */
export function parseArgs(argv: string[]): MineArgs {
  let dir = "";
  let project = "";
  let apply = false;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i] ?? "";
    else if (argv[i] === "--project") project = argv[++i] ?? "";
    else if (argv[i] === "--apply") apply = true;
    else if (argv[i] === "--out") out = argv[++i] ?? "";
  }
  if (!dir || !project) {
    throw new Error(
      "Usage: npx tsx scripts/mineKb.ts --dir <folder> --project <code> [--apply] [--out <file.json>]",
    );
  }
  return { dir, project, apply, out };
}

export type SenderCounts = Record<SenderType, number>;

/** Parse every input and tally messages by sender type. No raw text retained. */
export async function countBySender(source: CsvSource): Promise<{
  perFile: { name: string; counts: SenderCounts }[];
  total: SenderCounts;
}> {
  const inputs = await source();
  const total: SenderCounts = { customer: 0, admin: 0, bot: 0 };
  const perFile = inputs.map((input) => {
    const counts: SenderCounts = { customer: 0, admin: 0, bot: 0 };
    for (const msg of parseChatCsv(input.text)) {
      counts[msg.senderType]++;
      total[msg.senderType]++;
    }
    return { name: input.name, counts };
  });
  return { perFile, total };
}

/**
 * Mine candidate intents across every file. Each file is one customer's
 * conversation, so it is mined independently (contiguity/session pairing must
 * not cross customers); the per-file candidates are then merged by normalized
 * key. On merge, utterances are unioned + de-duped, occurrences summed, and the
 * `targetResponse` of the higher-occurrence contributor is kept — the exact
 * most-frequent-raw guarantee holds per file (see `crmKbMiner`); this cross-file
 * tie-break is a summary heuristic, good enough for the review-before-insert CLI.
 */
export async function mineCandidates(
  source: CsvSource,
  gapMinutes = GAP_MINUTES,
): Promise<IntentCandidate[]> {
  const inputs = await source();
  const lists = inputs.map((input) =>
    mineIntentCandidates(parseChatCsv(input.text), { gapMinutes }),
  );
  return mergeCandidates(lists);
}

/** Merge per-file candidate lists by normalized key; sort by occurrences desc. */
export function mergeCandidates(lists: IntentCandidate[][]): IntentCandidate[] {
  interface Acc extends IntentCandidate {
    seen: Set<string>;
    targetWeight: number;
    order: number;
  }
  const merged = new Map<string, Acc>();
  let order = 0;
  for (const list of lists) {
    for (const c of list) {
      let acc = merged.get(c.normalizedKey);
      if (!acc) {
        acc = {
          normalizedKey: c.normalizedKey,
          sampleUtterances: [],
          targetResponse: c.targetResponse,
          occurrences: 0,
          seen: new Set(),
          targetWeight: 0,
          order: order++,
        };
        merged.set(c.normalizedKey, acc);
      }
      acc.occurrences += c.occurrences;
      if (c.occurrences > acc.targetWeight) {
        acc.targetWeight = c.occurrences;
        acc.targetResponse = c.targetResponse;
      }
      for (const u of c.sampleUtterances) {
        if (!acc.seen.has(u)) {
          acc.seen.add(u);
          acc.sampleUtterances.push(u);
        }
      }
    }
  }
  return [...merged.values()]
    .sort((a, b) => b.occurrences - a.occurrences || a.order - b.order)
    .map(({ normalizedKey, sampleUtterances, targetResponse, occurrences }) => ({
      normalizedKey,
      sampleUtterances,
      targetResponse,
      occurrences,
    }));
}

/** One-line preview of already-scrubbed text (no raw PII); collapsed + capped. */
function preview(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export interface CandidateSummary {
  total: number;
  sensitive: number;
  /** Count of candidates per resolved response policy. */
  byPolicy: Record<ResponsePolicy, number>;
  annotated: AnnotatedCandidate[];
}

/**
 * Annotate every candidate (name + sensitivity + policy) and tally the sensitive
 * count and per-policy breakdown for the CLI summary. Pure — no I/O — so it is
 * unit-testable; the annotation itself is the offline heuristic (issue #180).
 */
export function summarizeCandidates(
  candidates: IntentCandidate[],
): CandidateSummary {
  const byPolicy: Record<ResponsePolicy, number> = {
    autopilot: 0,
    copilot_suggest: 0,
    force_human: 0,
  };
  let sensitive = 0;
  const annotated = candidates.map((c) => {
    const a = annotateCandidate(c);
    if (a.isSensitive) sensitive++;
    byPolicy[a.responsePolicy]++;
    return { ...c, ...a };
  });
  return { total: candidates.length, sensitive, byPolicy, annotated };
}

// ---------------------------------------------------------------------------
// Insert path (M4, issue #181). Thin, impure DB adapter — manually verified, NOT
// unit-tested against prod. The two decisions it rides on — the candidate→row
// field mapping (`candidateToDraftRow`) and the idempotent skip
// (`partitionNewCandidates`) — are PURE and unit-tested in `crmKbInsert.test.ts`.
// Guard: nothing here runs without `--apply` (the confirm gate in `main`).
// ---------------------------------------------------------------------------

/** Repo root (scripts/..) — the artifact must never be written inside it. */
const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * Existing-keys seam for idempotent re-runs. Returns the normalized intent keys
 * of the project's non-archived KB rows so already-present candidates are
 * skipped. Read-only. Each stored `target_response` is normalized the SAME way
 * as a mined candidate's key (`crmReplyNormalize`), so the two line up despite
 * decoration drift. Today it reads `crm_bot_knowledge_base`; the source function
 * seam (below) means a future `crm_chat_messages`-fed pipeline reuses this
 * unchanged.
 */
async function fetchExistingKeys(projectId: number): Promise<Set<string>> {
  const { query } = await import("../src/lib/db");
  const { rows } = await query(
    `SELECT target_response
       FROM crm_bot_knowledge_base
      WHERE project_id = $1 AND review_status <> 'archived'`,
    [projectId],
  );
  return new Set(
    (rows as { target_response: string }[]).map((r) =>
      crmReplyNormalize(r.target_response),
    ),
  );
}

/**
 * Insert the mapped draft rows in one transaction and return the new rule_ids.
 * `embedding` is omitted → stored NULL (n8n embeds on approve; ADR 0002/0005).
 * IMPURE and reached ONLY on `--apply`.
 */
async function insertDraftRows(rows: KbDraftRow[]): Promise<number[]> {
  if (rows.length === 0) return [];
  const { default: pool } = await import("../src/lib/db");
  const client = await pool.connect();
  const ids: number[] = [];
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      const { rows: inserted } = await client.query(
        `INSERT INTO crm_bot_knowledge_base
           (project_id, intent_name, sample_utterances, target_response,
            response_policy, is_sensitive, review_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING rule_id`,
        [
          row.project_id,
          row.intent_name,
          row.sample_utterances,
          row.target_response,
          row.response_policy,
          row.is_sensitive,
          row.review_status,
        ],
      );
      ids.push(inserted[0].rule_id);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return ids;
}

/** Audit artifact: what was produced + whether it was inserted. */
export interface MineArtifact {
  generatedAt: string;
  project: string;
  projectId: number;
  applied: boolean;
  counts: { candidates: number; toInsert: number; inserted: number; skipped: number };
  inserted: (KbDraftRow & { rule_id?: number })[];
  skipped: { intentName: string; normalizedKey: string }[];
}

/** Assemble the audit artifact from the partition + mapped rows. Pure. */
export function buildArtifact(params: {
  project: string;
  projectId: number;
  applied: boolean;
  candidateCount: number;
  rows: KbDraftRow[];
  insertedIds: number[];
  partition: CandidatePartition;
}): MineArtifact {
  const { project, projectId, applied, candidateCount, rows, insertedIds, partition } =
    params;
  return {
    generatedAt: new Date().toISOString(),
    project,
    projectId,
    applied,
    counts: {
      candidates: candidateCount,
      toInsert: rows.length,
      inserted: insertedIds.length,
      skipped: partition.skipped.length,
    },
    inserted: rows.map((row, i) =>
      insertedIds[i] != null ? { ...row, rule_id: insertedIds[i] } : { ...row },
    ),
    skipped: partition.skipped.map((c) => ({
      intentName: c.intentName,
      normalizedKey: c.normalizedKey,
    })),
  };
}

/**
 * Default artifact path OUTSIDE the repo: the project's gitignored crm-history
 * folder (sibling of the repo; PII-safe location).
 */
function defaultArtifactPath(project: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(
    os.homedir(),
    "workspaces",
    "flexio",
    "fixlo-crm-history",
    project,
    "artifacts",
    `mineKb-${stamp}.json`,
  );
}

/** Write the artifact, refusing any path that resolves INSIDE the repo tree. */
function writeArtifact(outPath: string, artifact: MineArtifact): void {
  const abs = path.resolve(outPath);
  const rel = path.relative(REPO_ROOT, abs);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
    throw new Error(
      `Refusing to write artifact inside the repo tree: ${abs}. Use a path outside ${REPO_ROOT}.`,
    );
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(artifact, null, 2), "utf8");
}

async function main() {
  const { dir, project, apply, out } = parseArgs(process.argv.slice(2));
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`Not a directory: ${abs}`);
  }

  const { perFile, total } = await countBySender(dirCsvSource(abs));

  console.log(`Project: ${project}`);
  console.log(`Source:  ${abs}`);
  console.log(`Files:   ${perFile.length}\n`);
  for (const { name, counts } of perFile) {
    console.log(
      `  ${name}  →  customer=${counts.customer} admin=${counts.admin} bot=${counts.bot}`,
    );
  }
  const grand = total.customer + total.admin + total.bot;
  console.log(
    `\nTotal: ${grand} messages  (customer=${total.customer} admin=${total.admin} bot=${total.bot})`,
  );

  const candidates = await mineCandidates(dirCsvSource(abs));
  const {
    total: candTotal,
    sensitive,
    byPolicy,
    annotated,
  } = summarizeCandidates(candidates);
  console.log(`\nCandidate intents: ${candTotal}`);
  console.log(
    `  sensitive: ${sensitive} / ${candTotal}  (non-sensitive: ${candTotal - sensitive})`,
  );
  console.log(
    `  policy: autopilot=${byPolicy.autopilot} copilot_suggest=${byPolicy.copilot_suggest} force_human=${byPolicy.force_human}`,
  );
  const shown = annotated.slice(0, 10);
  for (const c of shown) {
    const flag = c.isSensitive ? "⚠ sensitive" : "safe";
    console.log(
      `\n  • [${c.occurrences}×] ${c.intentName}  (${flag} → ${c.responsePolicy})`,
    );
    console.log(`      reply: ${preview(c.targetResponse)}`);
    for (const u of c.sampleUtterances.slice(0, 3)) {
      console.log(`      ↳ ${preview(u)}`);
    }
    const more = c.sampleUtterances.length - 3;
    if (more > 0) console.log(`      …and ${more} more utterance(s)`);
  }
  if (annotated.length > shown.length) {
    console.log(`\n  …and ${annotated.length - shown.length} more candidate(s)`);
  }

  // --- M4: resolve project → partition against existing rows → confirm gate ---
  const { resolveProject } = await import("../src/lib/projects");
  const projectRef = await resolveProject(project);
  if (!projectRef) {
    throw new Error(`Unknown or inactive project code: ${project}`);
  }

  const existingKeys = await fetchExistingKeys(projectRef.id);
  const partition = partitionNewCandidates(annotated, existingKeys);
  const rows = partition.toInsert.map((c) =>
    candidateToDraftRow(c, projectRef.id),
  );

  console.log(`\nProject id: ${projectRef.id} (${projectRef.code})`);
  console.log(
    `Insert plan: ${rows.length} new draft row(s), ` +
      `${partition.skipped.length} skipped (already present, non-archived).`,
  );

  let insertedIds: number[] = [];
  const { default: pool } = await import("../src/lib/db");
  try {
    if (apply) {
      // Explicit confirmation given (--apply): the ONLY path that writes.
      console.log(`\nApplying: inserting ${rows.length} draft row(s) as review_status='draft'…`);
      insertedIds = await insertDraftRows(rows);
      console.log(`Inserted rule_ids: ${insertedIds.join(", ") || "(none)"}`);
    } else {
      // Default: dry-run. No DB write happens.
      console.log(
        `\nDRY RUN — no rows written. Re-run with --apply to insert the ${rows.length} row(s) above.`,
      );
    }

    const artifactPath = out ? path.resolve(out) : defaultArtifactPath(project);
    writeArtifact(
      artifactPath,
      buildArtifact({
        project,
        projectId: projectRef.id,
        applied: apply,
        candidateCount: annotated.length,
        rows,
        insertedIds,
        partition,
      }),
    );
    console.log(`\nArtifact: ${artifactPath}`);
  } finally {
    // Release the shared pool so the process can exit.
    await pool.end();
  }
}

// Run only as a script, not when imported by tests.
if (process.argv[1] && process.argv[1].endsWith("mineKb.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
