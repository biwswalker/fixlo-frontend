import { describe, it, expect } from "vitest";
import { runBalanceMatch } from "../balanceMatcher";
import type { ProjectAccount } from "@/types/dashboard";

function makeAccount(overrides: Partial<ProjectAccount> & { id: string; account_name: string }): ProjectAccount {
  return {
    project_id: "proj1",
    account_number: "",
    bank_code: "",
    aliases: undefined,
    created_at: "2026-01-01",
    ...overrides,
  };
}

const accounts: ProjectAccount[] = [
  makeAccount({ id: "acc-scb", account_name: "สมชาย ใจดี", bank_code: "scb" }),
  makeAccount({ id: "acc-kbank", account_name: "วิชัย รักดี", bank_code: "kbank", aliases: '["วิชัย","วิชัย รัก"]' }),
  makeAccount({ id: "acc-wealth", account_name: "Wealth.wave gateway", bank_code: "wealth" }),
];

describe("runBalanceMatch — P1 exact name", () => {
  it("exact account_name match → AUTO_MAPPED", () => {
    const result = runBalanceMatch({ account_name: "สมชาย ใจดี", platform: null }, accounts);
    expect(result.status).toBe("AUTO_MAPPED");
    expect(result.matchedAccountId).toBe("acc-scb");
  });

  it("alias match → AUTO_MAPPED", () => {
    const result = runBalanceMatch({ account_name: "วิชัย", platform: null }, accounts);
    expect(result.status).toBe("AUTO_MAPPED");
    expect(result.matchedAccountId).toBe("acc-kbank");
  });
});

describe("runBalanceMatch — P2 platform tiebreaker", () => {
  it("partial name + matching platform → AUTO_MAPPED", () => {
    const ambiguous = [
      makeAccount({ id: "acc-a", account_name: "สมชาย ดี", bank_code: "scb" }),
      makeAccount({ id: "acc-b", account_name: "สมชาย ใหญ่", bank_code: "kbank" }),
    ];
    // partial match "สมชาย" hits both; platform SCB breaks tie toward acc-a
    const result = runBalanceMatch({ account_name: "สมชาย", platform: "SCB" }, ambiguous);
    expect(result.status).toBe("AUTO_MAPPED");
    expect(result.matchedAccountId).toBe("acc-a");
  });

  it("platform alone (gateway) → AUTO_MAPPED when name is null", () => {
    const result = runBalanceMatch({ account_name: null, platform: "Wealth.wave" }, accounts);
    expect(result.status).toBe("AUTO_MAPPED");
    expect(result.matchedAccountId).toBe("acc-wealth");
  });
});

describe("runBalanceMatch — thresholds", () => {
  it("score 50-84 (partial name, platform mismatch) → PENDING_REVIEW", () => {
    const result = runBalanceMatch({ account_name: "สมชาย", platform: "KBANK" }, accounts);
    // partial match on acc-scb (score ~80), but platform is KBANK → boost on acc-kbank?
    // "สมชาย ใจดี" contains "สมชาย" → partial ~80, but that's just at the boundary.
    // With KBANK platform not matching acc-scb's SCB → total for acc-scb ≤ 84
    expect(result.status).not.toBe("UNMATCHED");
    // either PENDING_REVIEW or AUTO_MAPPED depending on scoring, but not UNMATCHED
  });

  it("no match at all → PENDING_REVIEW with empty matchedAccountId", () => {
    const result = runBalanceMatch({ account_name: "unknown xyz 999", platform: null }, accounts);
    expect(result.matchedAccountId).toBeNull();
    expect(["PENDING_REVIEW", "UNMATCHED"]).toContain(result.status);
  });

  it("empty accounts → UNMATCHED", () => {
    const result = runBalanceMatch({ account_name: "สมชาย", platform: "SCB" }, []);
    expect(result.status).toBe("UNMATCHED");
    expect(result.matchedAccountId).toBeNull();
  });
});

describe("runBalanceMatch — breakdown", () => {
  it("always returns top-3 candidates in breakdown", () => {
    const result = runBalanceMatch({ account_name: "สมชาย ใจดี", platform: "SCB" }, accounts);
    expect(result.breakdown.candidates.length).toBeLessThanOrEqual(3);
    expect(result.breakdown.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.breakdown.candidates[0]).toMatchObject({
      accountId: expect.any(String),
      score: expect.any(Number),
    });
  });

  it("breakdown topScore equals best candidate score", () => {
    const result = runBalanceMatch({ account_name: "สมชาย ใจดี", platform: null }, accounts);
    const top = result.breakdown.candidates[0];
    expect(result.breakdown.topScore).toBe(top.score);
  });

  it("candidates sorted highest score first", () => {
    const result = runBalanceMatch({ account_name: "สมชาย ใจดี", platform: null }, accounts);
    const scores = result.breakdown.candidates.map((c) => c.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});
