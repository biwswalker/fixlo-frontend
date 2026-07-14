import { describe, it, expect } from "vitest";
import { summarizeCandidates } from "./mineKb";
import type { IntentCandidate } from "../src/lib/crmKbMiner";

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
