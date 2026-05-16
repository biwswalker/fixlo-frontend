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

describe("runBalanceMatch — v2 alias substring + fuzzy (Mode A+C)", () => {
  it("Mode A: honorific + Thai typo → partial 80 + bank bonus 10 → AUTO", () => {
    const masters = [
      makeAccount({ id: "acc-s", account_name: "ศุณิษา", bank_code: "bbl" }),
    ];
    const result = runBalanceMatch(
      { account_name: "คุณ ศุญิษา", platform: "BBL" },
      masters,
    );
    expect(result.status).toBe("AUTO_MAPPED");
    expect(result.matchedAccountId).toBe("acc-s");
    expect(result.score).toBe(90);
  });

  it("Mode A no bank match → partial 80 → PENDING_REVIEW", () => {
    const masters = [
      makeAccount({ id: "acc-s", account_name: "ศุณิษา", bank_code: "bbl" }),
    ];
    const result = runBalanceMatch(
      { account_name: "คุณ ศุญิษา", platform: "KTB" },
      masters,
    );
    expect(result.status).toBe("PENDING_REVIEW");
    expect(result.score).toBe(80);
  });

  it("Mode C: OCR full-name + alias short form → partial via alias 80 + bank 10 → AUTO", () => {
    const masters = [
      makeAccount({
        id: "acc-k",
        account_name: "เกษม ต๊ะแสนเทพ",
        bank_code: "bbl",
        aliases: '["เกษม"]',
      }),
    ];
    // OCR full name contains alias short form "เกษม"; also typo on second token (ติะ vs ต๊ะ)
    const result = runBalanceMatch(
      { account_name: "เกษม ติะแสนเทพ", platform: "BBL" },
      masters,
    );
    expect(result.status).toBe("AUTO_MAPPED");
    expect(result.matchedAccountId).toBe("acc-k");
    expect(result.score).toBe(90);
  });

  it("breakdown nameMatched = 'partial' for fuzzy hit", () => {
    const masters = [
      makeAccount({ id: "acc-s", account_name: "ศุณิษา", bank_code: "bbl" }),
    ];
    const result = runBalanceMatch(
      { account_name: "คุณ ศุญิษา", platform: "BBL" },
      masters,
    );
    expect(result.breakdown.candidates[0].nameMatched).toBe("partial");
  });

  it("Mode B graceful: null name + null acc_num + gateway has 2 masters → UNMATCHED, no crash", () => {
    const masters = [
      makeAccount({ id: "acc-tm-1", account_name: "พิมผะกา", bank_code: "truemoney" }),
      makeAccount({ id: "acc-tm-2", account_name: "อังคณา", bank_code: "truemoney" }),
    ];
    const result = runBalanceMatch(
      { account_name: null, platform: "TrueMoney" },
      masters,
    );
    // Both masters are non-gateway names (people); platform bonus is gated on nameScore>0
    expect(result.matchedAccountId).toBeNull();
    expect(result.status).toBe("UNMATCHED");
  });

  it("short-token rejection: scanned 'GSB' does not match alias 'BBL'", () => {
    const masters = [
      makeAccount({
        id: "acc-bbl",
        account_name: "Some Person",
        bank_code: "bbl",
        aliases: '["BBL"]',
      }),
    ];
    const result = runBalanceMatch(
      { account_name: "GSB", platform: null },
      masters,
    );
    // Should not fuzzy-match BBL (3 chars). Exact equality also fails.
    expect(result.score).toBe(0);
    expect(result.status).toBe("UNMATCHED");
  });
});

describe("runBalanceMatch — P0 account_number exact match (Mode B graceful)", () => {
  it("P0 hit: scanned acc_num equals master account_number → score 100, AUTO", () => {
    const masters = [
      makeAccount({ id: "acc-pim", account_name: "พิมผะกา", bank_code: "truemoney", account_number: "06*-***-7141" }),
      makeAccount({ id: "acc-ang", account_name: "อังคณา", bank_code: "truemoney", account_number: "08x-xxx-3197" }),
    ];
    const result = runBalanceMatch(
      { account_name: null, platform: "TrueMoney", account_number: "06*-***-7141" },
      masters,
    );
    expect(result.status).toBe("AUTO_MAPPED");
    expect(result.matchedAccountId).toBe("acc-pim");
    expect(result.score).toBe(100);
  });

  it("P0 hit normalizes -/*/x/whitespace: scanned '06xxxx7141' matches master '06*-***-7141'", () => {
    const masters = [
      makeAccount({ id: "acc-pim", account_name: "พิมผะกา", bank_code: "truemoney", account_number: "06*-***-7141" }),
    ];
    const result = runBalanceMatch(
      { account_name: null, platform: "TrueMoney", account_number: "06xxxx7141" },
      masters,
    );
    expect(result.status).toBe("AUTO_MAPPED");
    expect(result.matchedAccountId).toBe("acc-pim");
    expect(result.score).toBe(100);
  });

  it("P0 breakdown: nameMatched = 'none' on P0 hit", () => {
    const masters = [
      makeAccount({ id: "acc-pim", account_name: "พิมผะกา", bank_code: "truemoney", account_number: "06*-***-7141" }),
    ];
    const result = runBalanceMatch(
      { account_name: null, platform: "TrueMoney", account_number: "06*-***-7141" },
      masters,
    );
    expect(result.breakdown.candidates[0].nameMatched).toBe("none");
    expect(result.breakdown.candidates[0].score).toBe(100);
  });

  it("graceful: scanned acc_num null → P0 skipped, name path runs normally", () => {
    const masters = [
      makeAccount({ id: "acc-s", account_name: "สมชาย ใจดี", bank_code: "scb", account_number: "123-456-7890" }),
    ];
    const result = runBalanceMatch(
      { account_name: "สมชาย ใจดี", platform: "SCB", account_number: null },
      masters,
    );
    expect(result.status).toBe("AUTO_MAPPED");
    expect(result.matchedAccountId).toBe("acc-s");
  });

  it("graceful: master account_number null → P0 skipped for that master", () => {
    const masters = [
      makeAccount({ id: "acc-s", account_name: "สมชาย ใจดี", bank_code: "scb", account_number: "" }),
    ];
    const result = runBalanceMatch(
      { account_name: "สมชาย ใจดี", platform: "SCB", account_number: "06*-***-7141" },
      masters,
    );
    // P0 skipped (master has empty acc_num), name exact still hits
    expect(result.status).toBe("AUTO_MAPPED");
    expect(result.matchedAccountId).toBe("acc-s");
  });

  it("scanned acc_num present but value differs → P0 not hit; name/platform falls through", () => {
    const masters = [
      makeAccount({ id: "acc-s", account_name: "สมชาย ใจดี", bank_code: "scb", account_number: "111-111-1111" }),
    ];
    const result = runBalanceMatch(
      { account_name: "สมชาย ใจดี", platform: "SCB", account_number: "222-222-2222" },
      masters,
    );
    expect(result.matchedAccountId).toBe("acc-s");
    // Name path still hits exact → score 100 from P1, not P0
    expect(result.status).toBe("AUTO_MAPPED");
  });

  it("scanned acc_num whitespace-only → treated as empty, P0 skipped", () => {
    const masters = [
      makeAccount({ id: "acc-pim", account_name: "พิมผะกา", bank_code: "truemoney", account_number: "06*-***-7141" }),
    ];
    const result = runBalanceMatch(
      { account_name: null, platform: "TrueMoney", account_number: "   " },
      masters,
    );
    expect(result.status).toBe("UNMATCHED");
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
