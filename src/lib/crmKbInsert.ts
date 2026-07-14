// KB mining M4 (issue #181, PRD #177): turn reviewed candidates into `draft`
// rows for `crm_bot_knowledge_base`, and decide idempotently which candidates
// are new.
//
// PURE + testable. This module owns the candidate→row field mapping and the
// idempotent-skip partition — the two decisions that must be correct before
// anything touches the DB. The actual INSERT + CLI wiring is a thin adapter in
// `scripts/mineKb.ts` (manual verification per the PRD); it never lives here so
// these rules can be unit-tested without a database.
//
// Embedding: intentionally NOT part of the row. n8n generates the 768-d
// embedding when a supervisor APPROVES the draft (ADR 0002 §KB embeddings; ADR
// 0005 §6). We insert with `embedding` left NULL, so the column is simply
// omitted from the mapped row.

import type { IntentCandidate } from "./crmKbMiner";
import type { CandidateAnnotation } from "./crmSensitivityHeuristic";
import type { ResponsePolicy } from "./crmIntentPolicy";

/**
 * A mined candidate carrying its M3 annotation (name + sensitivity + policy).
 * This is the single input shape for the insert path; both `crmKbMiner` and
 * `crmSensitivityHeuristic` contribute their halves.
 */
export type AnnotatedCandidate = IntentCandidate & CandidateAnnotation;

/**
 * The subset of `crm_bot_knowledge_base` columns a mined draft sets. Column
 * names mirror the SQL schema (migration 054; docs/crm/n8n-handoff.md §2) so the
 * adapter can bind them positionally without a translation layer. `embedding`,
 * `is_active`, `created_at`, and `rule_id` are DB-side defaults (embedding =
 * NULL until n8n fills it on approve) and are deliberately absent.
 */
export interface KbDraftRow {
  project_id: number;
  intent_name: string;
  sample_utterances: string[];
  target_response: string;
  response_policy: ResponsePolicy;
  is_sensitive: boolean;
  /** Mined rows always land as `draft` — nothing is live until approved (S6). */
  review_status: "draft";
}

/**
 * Map one annotated candidate to a `draft` KB row scoped to `projectId`. The
 * embedding is left out on purpose (n8n embeds on approve). Pure.
 */
export function candidateToDraftRow(
  candidate: AnnotatedCandidate,
  projectId: number,
): KbDraftRow {
  return {
    project_id: projectId,
    intent_name: candidate.intentName,
    sample_utterances: candidate.sampleUtterances,
    target_response: candidate.targetResponse,
    response_policy: candidate.responsePolicy,
    is_sensitive: candidate.isSensitive,
    review_status: "draft",
  };
}

export interface CandidatePartition {
  /** New candidates to insert, in input order, each key at most once. */
  toInsert: AnnotatedCandidate[];
  /** Candidates skipped because their key already exists (in DB or the batch). */
  skipped: AnnotatedCandidate[];
}

/**
 * Split candidates into new vs already-present by normalized intent key, for an
 * idempotent re-run. A candidate is skipped when its `normalizedKey` is in
 * `existingKeys` (the keys of non-archived rows for this project, each derived
 * by normalizing that row's stored `target_response` the same way — see
 * `crmReplyNormalize`) OR when an earlier candidate in this same batch already
 * claimed the key. Pure — no DB — so the skip rule is unit-tested in isolation.
 */
export function partitionNewCandidates(
  candidates: AnnotatedCandidate[],
  existingKeys: Iterable<string>,
): CandidatePartition {
  const seen = new Set<string>(existingKeys);
  const toInsert: AnnotatedCandidate[] = [];
  const skipped: AnnotatedCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.normalizedKey)) {
      skipped.push(candidate);
    } else {
      seen.add(candidate.normalizedKey);
      toInsert.push(candidate);
    }
  }
  return { toInsert, skipped };
}
