import { describe, it, expect } from "vitest";
import {
  candidateToDraftRow,
  partitionNewCandidates,
  type AnnotatedCandidate,
} from "./crmKbInsert";

// SYNTHETIC data only — fabricated canned replies, no real customer PII.
const annotated = (
  overrides: Partial<AnnotatedCandidate> & { normalizedKey: string },
): AnnotatedCandidate => ({
  sampleUtterances: [],
  targetResponse: overrides.normalizedKey,
  occurrences: 1,
  intentName: "อินเทนต์",
  isSensitive: false,
  responsePolicy: "copilot_suggest",
  ...overrides,
});

describe("candidateToDraftRow", () => {
  it("maps a candidate to a draft KB row scoped to the project", () => {
    const row = candidateToDraftRow(
      annotated({
        normalizedKey: "รบกวนแจ้งชื่อเบอร์เลขบัญชี",
        sampleUtterances: ["สมัครยังไง", "ขอสมัคร"],
        targetResponse: "รบกวนแจ้งชื่อ-เบอร์-เลขบัญชีค่ะ",
        intentName: "รบกวนแจ้งชื่อ-เบอร์-เลขบัญชี",
        isSensitive: false,
        responsePolicy: "copilot_suggest",
      }),
      42,
    );
    expect(row).toEqual({
      project_id: 42,
      intent_name: "รบกวนแจ้งชื่อ-เบอร์-เลขบัญชี",
      sample_utterances: ["สมัครยังไง", "ขอสมัคร"],
      target_response: "รบกวนแจ้งชื่อ-เบอร์-เลขบัญชีค่ะ",
      response_policy: "copilot_suggest",
      is_sensitive: false,
      review_status: "draft",
    });
  });

  it("carries sensitivity + force_human policy for a sensitive candidate", () => {
    const row = candidateToDraftRow(
      annotated({
        normalizedKey: "ยอดฝากเข้าแล้ว",
        targetResponse: "ยอดฝากเข้าแล้วนะคะ",
        intentName: "ยอดฝากเข้าแล้ว",
        isSensitive: true,
        responsePolicy: "force_human",
      }),
      7,
    );
    expect(row.is_sensitive).toBe(true);
    expect(row.response_policy).toBe("force_human");
    expect(row.review_status).toBe("draft");
  });

  it("does not emit an embedding field (n8n fills it on approve)", () => {
    const row = candidateToDraftRow(annotated({ normalizedKey: "ก" }), 1);
    expect("embedding" in row).toBe(false);
  });
});

describe("partitionNewCandidates", () => {
  it("skips candidates whose normalized key already exists", () => {
    const cands = [
      annotated({ normalizedKey: "ยอดฝากเข้าแล้ว" }),
      annotated({ normalizedKey: "ดำเนินการถอนให้แล้ว" }),
      annotated({ normalizedKey: "รบกวนแจ้งชื่อ" }),
    ];
    const { toInsert, skipped } = partitionNewCandidates(
      cands,
      new Set(["ยอดฝากเข้าแล้ว"]),
    );
    expect(toInsert.map((c) => c.normalizedKey)).toEqual([
      "ดำเนินการถอนให้แล้ว",
      "รบกวนแจ้งชื่อ",
    ]);
    expect(skipped.map((c) => c.normalizedKey)).toEqual(["ยอดฝากเข้าแล้ว"]);
  });

  it("accepts existing keys as any iterable, not only a Set", () => {
    const cands = [
      annotated({ normalizedKey: "ก" }),
      annotated({ normalizedKey: "ข" }),
    ];
    const { toInsert, skipped } = partitionNewCandidates(cands, ["ข"]);
    expect(toInsert.map((c) => c.normalizedKey)).toEqual(["ก"]);
    expect(skipped.map((c) => c.normalizedKey)).toEqual(["ข"]);
  });

  it("de-duplicates within the batch so a re-run inserts a key once", () => {
    const cands = [
      annotated({ normalizedKey: "ก" }),
      annotated({ normalizedKey: "ก" }),
      annotated({ normalizedKey: "ข" }),
    ];
    const { toInsert, skipped } = partitionNewCandidates(cands, new Set());
    expect(toInsert.map((c) => c.normalizedKey)).toEqual(["ก", "ข"]);
    expect(skipped.map((c) => c.normalizedKey)).toEqual(["ก"]);
  });

  it("inserts everything when nothing exists yet", () => {
    const cands = [
      annotated({ normalizedKey: "ก" }),
      annotated({ normalizedKey: "ข" }),
    ];
    const { toInsert, skipped } = partitionNewCandidates(cands, new Set());
    expect(toInsert).toHaveLength(2);
    expect(skipped).toHaveLength(0);
  });

  it("handles an empty candidate list", () => {
    expect(partitionNewCandidates([], new Set(["ก"]))).toEqual({
      toInsert: [],
      skipped: [],
    });
  });
});
