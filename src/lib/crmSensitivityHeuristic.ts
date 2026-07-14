// KB mining M3 (issue #180, PRD #177): classify a mined candidate's
// sensitivity + response policy and derive a readable Thai intent name.
//
// Pure + offline: a keyword heuristic over already-mined text, no LLM/API/DB
// call at runtime (ADR 0002). The classification is a labelling aid for the
// KB-review pass — a supervisor can override sensitivity/policy and rename the
// intent in the Fixlo UI later.
//
// Bias: toward SENSITIVE. Any money/complaint signal (deposit, withdrawal,
// transfer, credit, balance, "not in", "slow", "wrong", "complaint") marks the
// intent sensitive → force_human (the ADR 0005 lock). The one carve-out is a
// "collect information" canned reply — asking the customer to PROVIDE their
// name/phone/account so an agent can act, not a reply that transacts or reports
// on money — which stays non-sensitive → copilot_suggest. Sensitive locking is
// delegated to `crmIntentPolicy.effectivePolicy`, the single source of truth.

import { effectivePolicy, type ResponsePolicy } from "./crmIntentPolicy";

/** The parts of a mined candidate this heuristic reads (see `crmKbMiner`). */
export type SensitivityInput = {
  /** The canned admin reply that defines the intent. */
  targetResponse: string;
  /** Customer utterances that preceded the reply. */
  sampleUtterances: string[];
};

export interface SensitivityResult {
  isSensitive: boolean;
  responsePolicy: ResponsePolicy;
}

/** Full sensitivity annotation for a candidate: name + sensitivity + policy. */
export interface CandidateAnnotation extends SensitivityResult {
  /** Concise, human-readable Thai label derived from the reply. */
  intentName: string;
}

// Money/complaint terms. Any hit (in the reply OR an utterance) is a sensitive
// signal unless the reply is a pure collect-info request (below). Mirrors the
// deposit/withdrawal/complaint categories the ADR locks to force_human.
const MONEY_COMPLAINT = /ถอน|ฝาก|เครดิต|โอน|ยอด|ช้า|ไม่เข้า|ผิด|ร้องเรียน/;

// "Strong" signals that can never be part of a collect-info template: a balance
// reference or an outright complaint. Their presence in the reply disqualifies
// the info-request carve-out, so a transaction/complaint reply that happens to
// also ask for an account number is still treated as sensitive.
const STRONG_SIGNAL = /ยอด|ช้า|ไม่เข้า|ผิด|ร้องเรียน/;

// A collect-info reply pairs a request verb with a contact/identity field. Note
// "บัญชี" (account) is a field here, and "บัญชีฝาก" (deposit account) is a field
// name — not a deposit transaction — so such a reply stays non-sensitive.
const REQUEST_VERB = /รบกวน|กรุณา|ขอ|แจ้ง|กรอก|ส่ง/;
const INFO_FIELD = /ชื่อ|เบอร์|บัญชี|ยูส|user|รหัส|โทร|ไอดี|line|ไลน์/i;

/**
 * A "collect information" canned reply: asks the customer to provide their
 * name/phone/account (to collect, not to transact) and carries no balance or
 * complaint signal. These stay non-sensitive even when they name a deposit or
 * withdrawal account.
 */
function isCollectInfoReply(reply: string): boolean {
  if (STRONG_SIGNAL.test(reply)) return false;
  return REQUEST_VERB.test(reply) && INFO_FIELD.test(reply);
}

/**
 * Classify a candidate's sensitivity and resolve its response policy. Sensitive
 * intents are locked to `force_human` via `effectivePolicy`; everything else
 * defaults to `copilot_suggest` (ADR 0005 phase-1 default).
 */
export function classifySensitivity(
  candidate: SensitivityInput,
): SensitivityResult {
  const reply = candidate.targetResponse ?? "";
  let isSensitive: boolean;
  if (isCollectInfoReply(reply)) {
    isSensitive = false;
  } else {
    const haystack = [reply, ...candidate.sampleUtterances].join("\n");
    isSensitive = MONEY_COMPLAINT.test(haystack);
  }
  const requested: ResponsePolicy = isSensitive
    ? "force_human"
    : "copilot_suggest";
  return {
    isSensitive,
    responsePolicy: effectivePolicy(requested, isSensitive),
  };
}

// Politeness particles / clause enders Thai canned replies trail with. Cutting
// at the first one yields a concise leading clause without truncating mid-word.
const CLAUSE_BOUNDARY = /ค่ะ|คะ|ครับ|นะคะ|นะครับ|ค่า|จ้า|จ้ะ|[\n\r.!?,;:•]/;
const MAX_NAME = 30;

/**
 * Derive a concise Thai `intentName` from a candidate's reply — its first
 * meaningful clause, capped in length. Deterministic and offline; a supervisor
 * renames it in the UI. Empty replies fall back to a generic label.
 */
export function deriveIntentName(candidate: SensitivityInput): string {
  const first = (candidate.targetResponse ?? "")
    .split(/[\n\r]/)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (!first) return "ไม่ระบุ";
  const clause = first.split(CLAUSE_BOUNDARY)[0].trim() || first;
  if (clause.length > MAX_NAME) return `${clause.slice(0, MAX_NAME - 1).trim()}…`;
  return clause;
}

/** Convenience: full annotation (name + sensitivity + policy) for one candidate. */
export function annotateCandidate(
  candidate: SensitivityInput,
): CandidateAnnotation {
  return {
    intentName: deriveIntentName(candidate),
    ...classifySensitivity(candidate),
  };
}
