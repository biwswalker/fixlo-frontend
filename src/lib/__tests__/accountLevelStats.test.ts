import { describe, it, expect } from "vitest";
import { buildAccountLevelStats, applyApayReportOverride } from "../accountLevelStats";
import type { ParsedApayAccountReport } from "../apayStats";

describe("buildAccountLevelStats — transactions only", () => {
  it("single account sums systemOutflow and count", () => {
    const stats = buildAccountLevelStats(
      [
        { account_name: "สมชาย ใจดี", ai_amount: 500 },
        { account_name: "สมชาย ใจดี", ai_amount: 300 },
      ],
      [],
    );
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      account: "สมชาย ใจดี",
      systemOutflow: 800,
      count: 2,
      effectiveOutflow: 800,
      closingBalance: null,
    });
  });

  it("null account_name falls under 'Unmapped'", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: null, ai_amount: 100 }],
      [],
    );
    expect(stats[0].account).toBe("Unmapped");
  });

  it("multiple accounts grouped independently", () => {
    const stats = buildAccountLevelStats(
      [
        { account_name: "A", ai_amount: 200 },
        { account_name: "B", ai_amount: 100 },
        { account_name: "A", ai_amount: 50 },
      ],
      [],
    );
    expect(stats).toHaveLength(2);
    const a = stats.find((s) => s.account === "A")!;
    expect(a.systemOutflow).toBe(250);
    expect(a.count).toBe(2);
  });
});


describe("buildAccountLevelStats — closing balances", () => {
  it("account with matched snapshot gets closingBalance set", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: 100 }],
      [{ account_name: "A", closing_balance: 9500 }],
    );
    expect(stats[0].closingBalance).toBe(9500);
  });

  it("account with snapshot but no transactions appears with systemOutflow=0", () => {
    const stats = buildAccountLevelStats(
      [],
      [{ account_name: "BalanceOnly", closing_balance: 5000 }],
    );
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      account: "BalanceOnly",
      systemOutflow: 0,
      count: 0,
      closingBalance: 5000,
    });
  });

  it("account with no snapshot has closingBalance null", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "NoSnapshot", ai_amount: 200 }],
      [],
    );
    expect(stats[0].closingBalance).toBeNull();
  });

  it("null closing_balance stored as null", () => {
    const stats = buildAccountLevelStats(
      [],
      [{ account_name: "A", closing_balance: null }],
    );
    expect(stats[0].closingBalance).toBeNull();
  });
});

describe("buildAccountLevelStats — sort order", () => {
  it("sorted by effectiveOutflow descending", () => {
    const stats = buildAccountLevelStats(
      [
        { account_name: "Low", ai_amount: 100 },
        { account_name: "High", ai_amount: 900 },
        { account_name: "Mid", ai_amount: 500 },
      ],
      [],
    );
    const outflows = stats.map((s) => s.effectiveOutflow);
    for (let i = 1; i < outflows.length; i++) {
      expect(outflows[i]).toBeLessThanOrEqual(outflows[i - 1]);
    }
  });
});

describe("buildAccountLevelStats — edge cases", () => {
  it("empty inputs return empty array", () => {
    expect(buildAccountLevelStats([], [])).toEqual([]);
  });

  it("string ai_amount coerced to number", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: "250" as any }],
      [],
    );
    expect(stats[0].systemOutflow).toBe(250);
  });

  it("null ai_amount treated as 0", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: null }],
      [],
    );
    expect(stats[0].systemOutflow).toBe(0);
    expect(stats[0].count).toBe(1);
  });
});

describe("buildAccountLevelStats — account metadata (#48)", () => {
  it("tx row with account_id, bank_code, account_number propagates to stat", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "สมชาย ใจดี", ai_amount: 500, account_id: "uuid-1", bank_code: "scb", account_number: "123456789" }],
      [],
    );
    expect(stats[0].accountId).toBe("uuid-1");
    expect(stats[0].bankCode).toBe("scb");
    expect(stats[0].accountNumber).toBe("123456789");
  });

  it("unmapped row (null account_id) → accountId null, bankCode null", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: null, ai_amount: 100, account_id: null, bank_code: null, account_number: null }],
      [],
    );
    expect(stats[0].account).toBe("Unmapped");
    expect(stats[0].accountId).toBeNull();
    expect(stats[0].bankCode).toBeNull();
    expect(stats[0].accountNumber).toBeNull();
  });

  it("multiple rows for same account use accountId from first row", () => {
    const stats = buildAccountLevelStats(
      [
        { account_name: "A", ai_amount: 100, account_id: "acc-1", bank_code: "kbank", account_number: "9999" },
        { account_name: "A", ai_amount: 200, account_id: "acc-1", bank_code: "kbank", account_number: "9999" },
      ],
      [],
    );
    expect(stats[0].accountId).toBe("acc-1");
    expect(stats[0].bankCode).toBe("kbank");
    expect(stats[0].accountNumber).toBe("9999");
  });

  it("rows without metadata fields default to null (backward compat)", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "Legacy", ai_amount: 100 }],
      [],
    );
    expect(stats[0].accountId).toBeNull();
    expect(stats[0].bankCode).toBeNull();
    expect(stats[0].accountNumber).toBeNull();
  });
});

describe("buildAccountLevelStats — manual outflow (#49)", () => {
  it("manual tx row adds to manualOutflow for that account", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: 500 }],
      [],
      [{ account_name: "A", amount: 200 }],
    );
    expect(stats[0].manualOutflow).toBe(200);
    expect(stats[0].systemOutflow).toBe(500);
  });

  it("effectiveOutflow = systemOutflow + manualOutflow", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: 500 }],
      [],
      [{ account_name: "A", amount: 100 }],
    );
    expect(stats[0].manualOutflow).toBe(100);
    expect(stats[0].effectiveOutflow).toBe(600);
  });

  it("account with only manual tx and no discord tx appears with systemOutflow=0", () => {
    const stats = buildAccountLevelStats(
      [],
      [],
      [{ account_name: "ManualOnly", amount: 300 }],
    );
    expect(stats).toHaveLength(1);
    expect(stats[0].account).toBe("ManualOnly");
    expect(stats[0].systemOutflow).toBe(0);
    expect(stats[0].manualOutflow).toBe(300);
    expect(stats[0].effectiveOutflow).toBe(300);
  });

  it("no manual rows → manualOutflow is 0 for all accounts", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "B", ai_amount: 400 }],
      [],
    );
    expect(stats[0].manualOutflow).toBe(0);
  });

  it("null amount in manual row treated as 0", () => {
    const stats = buildAccountLevelStats(
      [],
      [],
      [{ account_name: "A", amount: null }],
    );
    expect(stats[0].manualOutflow).toBe(0);
  });
});

describe("buildAccountLevelStats — dual-balance fields (#64)", () => {
  it("account with both balance rows gets selectedDayBalance and prevDayBalance", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: 500 }],
      [],
      [],
      [{ account_name: "A", balance_amount: 10000 }],
      [{ account_name: "A", balance_amount: 9000 }],
    );
    expect(stats[0].selectedDayBalance).toBe(10000);
    expect(stats[0].prevDayBalance).toBe(9000);
  });

  it("account with transactions but missing both balance rows → both null", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: 500 }],
      [],
      [],
      [],
      [],
    );
    expect(stats[0].selectedDayBalance).toBeNull();
    expect(stats[0].prevDayBalance).toBeNull();
  });

  it("account with only selectedDayBalance row → prevDayBalance is null", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: 500 }],
      [],
      [],
      [{ account_name: "A", balance_amount: 10000 }],
      [],
    );
    expect(stats[0].selectedDayBalance).toBe(10000);
    expect(stats[0].prevDayBalance).toBeNull();
  });

  it("account with only prevDayBalance row → selectedDayBalance is null", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: 500 }],
      [],
      [],
      [],
      [{ account_name: "A", balance_amount: 9000 }],
    );
    expect(stats[0].selectedDayBalance).toBeNull();
    expect(stats[0].prevDayBalance).toBe(9000);
  });
});

describe("buildAccountLevelStats — slip adjustment (#55)", () => {
  it("adjusted_amount on tx row is used instead of ai_amount", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: 500, adjusted_amount: 350 }],
      [],
    );
    expect(stats[0].systemOutflow).toBe(350);
    expect(stats[0].effectiveOutflow).toBe(350);
  });

  it("null adjusted_amount falls back to ai_amount", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: 500, adjusted_amount: null }],
      [],
    );
    expect(stats[0].systemOutflow).toBe(500);
  });

  it("undefined adjusted_amount falls back to ai_amount", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "A", ai_amount: 500 }],
      [],
    );
    expect(stats[0].systemOutflow).toBe(500);
  });

  it("adjusted_amount sums correctly across multiple slips for same account", () => {
    const stats = buildAccountLevelStats(
      [
        { account_name: "A", ai_amount: 500, adjusted_amount: 300 },
        { account_name: "A", ai_amount: 200, adjusted_amount: null },
      ],
      [],
    );
    expect(stats[0].systemOutflow).toBe(500); // 300 + 200
  });
});

describe("applyApayReportOverride (ADR 0016)", () => {
  const report = (over: Partial<ParsedApayAccountReport> = {}): ParsedApayAccountReport => ({
    accountId: "apay-1",
    accountName: "ACCTEAM",
    bankCode: "Apay",
    gatewayInflow: 45000,
    gatewayOutflow: 12000,
    reportSource: "scraper",
    ...over,
  });

  it("replaces an existing Apay row's outflow with gateway withdrawal and zeroes slip/manual", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "ACCTEAM", ai_amount: 999, account_id: "old", bank_code: "Apay" }],
      [],
    );
    applyApayReportOverride(stats, report());
    const apay = stats.find((s) => s.account === "ACCTEAM")!;
    expect(apay.reportSourced).toBe(true);
    expect(apay.effectiveOutflow).toBe(12000);
    expect(apay.gatewayInflow).toBe(45000);
    expect(apay.systemOutflow).toBe(0);
    expect(apay.manualOutflow).toBe(0);
    expect(apay.count).toBe(0);
  });

  it("injects an Apay row when none exists yet", () => {
    const stats = buildAccountLevelStats([{ account_name: "SCB สมชาย", ai_amount: 500 }], []);
    applyApayReportOverride(stats, report());
    expect(stats).toHaveLength(2);
    expect(stats.find((s) => s.account === "ACCTEAM")?.reportSourced).toBe(true);
  });

  it("balance-only account: snapshots fed via the balance param (display-only)", () => {
    // buildAccountLevelStats never creates a row for a balance-only account,
    // so the Apay daily_balances must be passed into the override directly.
    const stats = buildAccountLevelStats([], []);
    applyApayReportOverride(stats, report(), {
      selectedDayBalance: 80000,
      prevDayBalance: 50000,
      selectedDayStatus: "AUTO_MAPPED",
      prevDayStatus: "AUTO_MAPPED",
      selectedDayImagePath: null,
      prevDayImagePath: null,
      selectedDayBalanceId: 7,
      prevDayBalanceId: 6,
      selectedDaySource: "scraper",
      prevDaySource: "scraper",
    });
    const apay = stats.find((s) => s.account === "ACCTEAM")!;
    expect(apay.selectedDayBalance).toBe(80000);
    expect(apay.prevDayBalance).toBe(50000);
    // ยอดรับ comes from gateway deposit, NOT balance delta (80000-50000=30000)
    expect(apay.gatewayInflow).toBe(45000);
  });

  it("existing row's enriched balance takes precedence over the balance param", () => {
    const stats = buildAccountLevelStats(
      [{ account_name: "ACCTEAM", ai_amount: 10, account_id: "old", bank_code: "Apay" }],
      [],
      [],
      [{ account_name: "ACCTEAM", balance_amount: 80000 }],
      [{ account_name: "ACCTEAM", balance_amount: 50000 }],
    );
    applyApayReportOverride(stats, report(), {
      selectedDayBalance: 1,
      prevDayBalance: 2,
      selectedDayStatus: null, prevDayStatus: null,
      selectedDayImagePath: null, prevDayImagePath: null,
      selectedDayBalanceId: null, prevDayBalanceId: null,
      selectedDaySource: null, prevDaySource: null,
    });
    const apay = stats.find((s) => s.account === "ACCTEAM")!;
    expect(apay.selectedDayBalance).toBe(80000);
    expect(apay.prevDayBalance).toBe(50000);
  });

  it("no report row → gateway values null (renders ไม่มีรายงาน), effectiveOutflow 0", () => {
    const stats = buildAccountLevelStats([], []);
    applyApayReportOverride(
      stats,
      report({ gatewayInflow: null, gatewayOutflow: null, reportSource: null }),
    );
    const apay = stats.find((s) => s.account === "ACCTEAM")!;
    expect(apay.reportSourced).toBe(true);
    expect(apay.gatewayInflow).toBeNull();
    expect(apay.gatewayOutflow).toBeNull();
    expect(apay.effectiveOutflow).toBe(0);
  });
});
