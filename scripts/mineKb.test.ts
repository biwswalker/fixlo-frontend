import { describe, it, expect } from "vitest";
import {
  summarizeCandidates,
  buildArtifact,
  filterByMinOccurrences,
  parseArgs,
  DEFAULT_MIN_OCCURRENCES,
} from "./mineKb";
import type { IntentCandidate } from "../src/lib/crmKbMiner";
import type {
  AnnotatedCandidate,
  KbDraftRow,
} from "../src/lib/crmKbInsert";

// SYNTHETIC data only — fabricated canned replies, no real customer PII.
const cand = (
  targetResponse: string,
  sampleUtterances: string[] = [],
  occurrences = 1,
): IntentCandidate => ({
  normalizedKey: targetResponse,
  sampleUtterances,
  targetResponse,
  occurrences,
});

describe("summarizeCandidates", () => {
  it("tallies the sensitive count and per-policy breakdown", () => {
    const s = summarizeCandidates([
      cand("ยอดฝากเข้าแล้วนะคะ"), // sensitive → force_human
      cand("ดำเนินการถอนให้แล้วค่ะ"), // sensitive → force_human
      cand("รบกวนแจ้งชื่อ-เบอร์-เลขบัญชีค่ะ"), // collect-info → copilot_suggest
    ]);
    expect(s.total).toBe(3);
    expect(s.sensitive).toBe(2);
    expect(s.byPolicy).toEqual({
      autopilot: 0,
      copilot_suggest: 1,
      force_human: 2,
    });
  });

  it("annotates each candidate with an intent name + resolved policy", () => {
    const s = summarizeCandidates([cand("ยอดฝากเข้าแล้วนะคะ", ["ฝากไม่เข้า"], 4)]);
    expect(s.annotated[0]).toMatchObject({
      occurrences: 4,
      intentName: "ยอดฝากเข้าแล้ว",
      isSensitive: true,
      responsePolicy: "force_human",
    });
  });

  it("handles an empty candidate list", () => {
    expect(summarizeCandidates([])).toEqual({
      total: 0,
      sensitive: 0,
      byPolicy: { autopilot: 0, copilot_suggest: 0, force_human: 0 },
      annotated: [],
    });
  });
});

describe("buildArtifact", () => {
  const draftRow = (intentName: string): KbDraftRow => ({
    project_id: 9,
    intent_name: intentName,
    sample_utterances: [],
    target_response: intentName,
    response_policy: "copilot_suggest",
    is_sensitive: false,
    review_status: "draft",
  });
  const skippedCand = (normalizedKey: string): AnnotatedCandidate => ({
    normalizedKey,
    sampleUtterances: [],
    targetResponse: normalizedKey,
    occurrences: 1,
    intentName: normalizedKey,
    isSensitive: false,
    responsePolicy: "copilot_suggest",
  });

  it("records inserted rule_ids and skipped keys on an applied run", () => {
    const artifact = buildArtifact({
      project: "juno168",
      projectId: 9,
      applied: true,
      candidateCount: 3,
      rows: [draftRow("ก"), draftRow("ข")],
      insertedIds: [101, 102],
      partition: { toInsert: [], skipped: [skippedCand("ค")] },
    });
    expect(artifact.applied).toBe(true);
    expect(artifact.counts).toEqual({
      candidates: 3,
      toInsert: 2,
      inserted: 2,
      skipped: 1,
    });
    expect(artifact.inserted).toEqual([
      { ...draftRow("ก"), rule_id: 101 },
      { ...draftRow("ข"), rule_id: 102 },
    ]);
    expect(artifact.skipped).toEqual([{ intentName: "ค", normalizedKey: "ค" }]);
  });

  it("omits rule_ids on a dry run (nothing inserted)", () => {
    const artifact = buildArtifact({
      project: "juno168",
      projectId: 9,
      applied: false,
      candidateCount: 1,
      rows: [draftRow("ก")],
      insertedIds: [],
      partition: { toInsert: [], skipped: [] },
    });
    expect(artifact.applied).toBe(false);
    expect(artifact.counts.inserted).toBe(0);
    expect(artifact.inserted).toEqual([draftRow("ก")]);
    expect("rule_id" in artifact.inserted[0]).toBe(false);
  });
});

describe("filterByMinOccurrences", () => {
  it("drops candidates below the threshold, keeps at/above it", () => {
    const cands = [cand("A", [], 15), cand("B", [], 10), cand("C", [], 9), cand("D", [], 1)];
    const kept = filterByMinOccurrences(cands, 10);
    expect(kept.map((c) => c.targetResponse)).toEqual(["A", "B"]);
  });

  it("returns everything when min is 1", () => {
    const cands = [cand("A", [], 1), cand("B", [], 3)];
    expect(filterByMinOccurrences(cands, 1)).toHaveLength(2);
  });

  it("returns an empty array when nothing meets the threshold", () => {
    const cands = [cand("A", [], 2), cand("B", [], 3)];
    expect(filterByMinOccurrences(cands, 10)).toEqual([]);
  });
});

describe("parseArgs --min-occurrences", () => {
  const base = ["--dir", "/tmp/x", "--project", "juno168"];

  it("defaults to DEFAULT_MIN_OCCURRENCES when omitted", () => {
    expect(parseArgs(base).minOccurrences).toBe(DEFAULT_MIN_OCCURRENCES);
  });

  it("parses an explicit --min-occurrences", () => {
    expect(parseArgs([...base, "--min-occurrences", "5"]).minOccurrences).toBe(5);
  });

  it("rejects a non-positive-integer value", () => {
    expect(() => parseArgs([...base, "--min-occurrences", "0"])).toThrow();
    expect(() => parseArgs([...base, "--min-occurrences", "abc"])).toThrow();
    expect(() => parseArgs([...base, "--min-occurrences", "-3"])).toThrow();
  });
});
