#!/usr/bin/env tsx
/**
 * KB mining CLI — slice M1 skeleton (issue #178, PRD #177).
 *
 * Reads a folder of LINE OA chat-history CSV exports for one project, parses
 * each into scrubbed ChatMessage records, and prints per-sender counts. Later
 * slices add reply grouping, sensitivity, the summary/confirm gate, and the
 * prod insert — this only proves the parse path end-to-end.
 *
 * Usage:
 *   npx tsx scripts/mineKb.ts --dir <folder> --project <code>
 *
 * The CSV history lives OUTSIDE the repo (~/workspaces/flexio/fixlo-crm-history/
 * <project>/, gitignored — PII + passwords). Input is read through a small
 * source seam (CsvSource) so a crm_chat_messages DB source can plug in later
 * with no change to the mining logic. Nothing raw (PII/passwords) is printed:
 * only aggregate counts, over already-scrubbed text.
 */

import fs from "fs";
import path from "path";
import { parseChatCsv, type SenderType } from "../src/lib/crmChatCsvParse";

/** A named CSV blob to mine. `name` is for logging only (never its contents). */
export interface CsvInput {
  name: string;
  text: string;
}

/** Source seam: returns the CSV texts to mine. Swap for a DB source later. */
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
}

/** Minimal flag parser for `--dir` and `--project`. */
export function parseArgs(argv: string[]): MineArgs {
  let dir = "";
  let project = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i] ?? "";
    else if (argv[i] === "--project") project = argv[++i] ?? "";
  }
  if (!dir || !project) {
    throw new Error(
      "Usage: npx tsx scripts/mineKb.ts --dir <folder> --project <code>",
    );
  }
  return { dir, project };
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

async function main() {
  const { dir, project } = parseArgs(process.argv.slice(2));
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
}

// Run only as a script, not when imported by tests.
if (process.argv[1] && process.argv[1].endsWith("mineKb.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
