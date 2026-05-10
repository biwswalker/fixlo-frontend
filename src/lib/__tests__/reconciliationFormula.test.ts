import { describe, it, expect } from "vitest";
import { computeKpi } from "../reconciliationFormula";

// RED: fails until module is created
describe("computeKpi", () => {
  it("empty input returns zeros", () => {
    const result = computeKpi([]);
    expect(result.deposits).toBe(0);
    expect(result.withdrawals).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.byDay).toEqual([]);
  });

  it("sums deposits = deposit + manual_in + bonus + fixed_deposit", () => {
    const result = computeKpi([
      {
        report_date: "2026-05-01",
        project_id: "juno168",
        deposit: 100,
        manual_in: 20,
        bonus: 10,
        fixed_deposit: 5,
        withdraw: 0,
        manual_out: 0,
        redeem: 0,
        affiliate: 0,
        cashback: 0,
        balance: 500,
      },
    ]);
    expect(result.deposits).toBe(135);
  });

  it("sums withdrawals = withdraw + manual_out + redeem + affiliate + cashback", () => {
    const result = computeKpi([
      {
        report_date: "2026-05-01",
        project_id: "juno168",
        deposit: 0,
        manual_in: 0,
        bonus: 0,
        fixed_deposit: 0,
        withdraw: 50,
        manual_out: 10,
        redeem: 5,
        affiliate: 3,
        cashback: 2,
        balance: 500,
      },
    ]);
    expect(result.withdrawals).toBe(70);
  });

  it("balance = latest balance snapshot (last row by date)", () => {
    const result = computeKpi([
      { report_date: "2026-05-01", project_id: "juno168", deposit: 0, manual_in: 0, bonus: 0, fixed_deposit: 0, withdraw: 0, manual_out: 0, redeem: 0, affiliate: 0, cashback: 0, balance: 100 },
      { report_date: "2026-05-03", project_id: "juno168", deposit: 0, manual_in: 0, bonus: 0, fixed_deposit: 0, withdraw: 0, manual_out: 0, redeem: 0, affiliate: 0, cashback: 0, balance: 300 },
      { report_date: "2026-05-02", project_id: "juno168", deposit: 0, manual_in: 0, bonus: 0, fixed_deposit: 0, withdraw: 0, manual_out: 0, redeem: 0, affiliate: 0, cashback: 0, balance: 200 },
    ]);
    expect(result.balance).toBe(300);
  });

  it("all-NULL columns treated as 0", () => {
    const result = computeKpi([
      {
        report_date: "2026-05-01",
        project_id: "juno168",
        deposit: null,
        manual_in: null,
        bonus: null,
        fixed_deposit: null,
        withdraw: null,
        manual_out: null,
        redeem: null,
        affiliate: null,
        cashback: null,
        balance: null,
      } as any,
    ]);
    expect(result.deposits).toBe(0);
    expect(result.withdrawals).toBe(0);
    expect(result.balance).toBe(0);
  });

  it("multi-project aggregation sums across all projects", () => {
    const result = computeKpi([
      { report_date: "2026-05-01", project_id: "juno168", deposit: 100, manual_in: 0, bonus: 0, fixed_deposit: 0, withdraw: 0, manual_out: 0, redeem: 0, affiliate: 0, cashback: 0, balance: 200 },
      { report_date: "2026-05-01", project_id: "uno", deposit: 50, manual_in: 0, bonus: 0, fixed_deposit: 0, withdraw: 0, manual_out: 0, redeem: 0, affiliate: 0, cashback: 0, balance: 100 },
    ]);
    expect(result.deposits).toBe(150);
  });

  it("single-project filter with projectId returns only that project", () => {
    const result = computeKpi(
      [
        { report_date: "2026-05-01", project_id: "juno168", deposit: 100, manual_in: 0, bonus: 0, fixed_deposit: 0, withdraw: 0, manual_out: 0, redeem: 0, affiliate: 0, cashback: 0, balance: 200 },
        { report_date: "2026-05-01", project_id: "uno", deposit: 50, manual_in: 0, bonus: 0, fixed_deposit: 0, withdraw: 0, manual_out: 0, redeem: 0, affiliate: 0, cashback: 0, balance: 100 },
      ],
      "juno168",
    );
    expect(result.deposits).toBe(100);
    expect(result.balance).toBe(200);
  });

  it("byDay groups deposits and withdrawals per date", () => {
    const result = computeKpi([
      { report_date: "2026-05-01", project_id: "juno168", deposit: 100, manual_in: 0, bonus: 0, fixed_deposit: 0, withdraw: 50, manual_out: 0, redeem: 0, affiliate: 0, cashback: 0, balance: 200 },
      { report_date: "2026-05-02", project_id: "juno168", deposit: 200, manual_in: 0, bonus: 0, fixed_deposit: 0, withdraw: 80, manual_out: 0, redeem: 0, affiliate: 0, cashback: 0, balance: 300 },
    ]);
    expect(result.byDay).toHaveLength(2);
    expect(result.byDay[0]).toMatchObject({ date: "2026-05-01", deposits: 100, withdrawals: 50 });
    expect(result.byDay[1]).toMatchObject({ date: "2026-05-02", deposits: 200, withdrawals: 80 });
  });
});
