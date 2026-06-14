import { describe, it, expect } from "vitest";
import { computeInflow, computePerAccountInflow, resolveAccountInflow } from "../inflowFormula";

interface BalanceRow {
  project_account_id: string;
  date: string;
  balance_amount: number;
}

interface TxOutflow {
  project_account_id: string;
  date: string;
  total_outflow: number;
}

describe("computeInflow — single account, single day", () => {
  it("inflow = balance_D - balance_D-1 + withdrawals_D", () => {
    const balances: BalanceRow[] = [
      { project_account_id: "acc1", date: "2026-05-01", balance_amount: 1000 },
      { project_account_id: "acc1", date: "2026-05-02", balance_amount: 1300 },
    ];
    const outflows: TxOutflow[] = [
      { project_account_id: "acc1", date: "2026-05-02", total_outflow: 200 },
    ];
    const result = computeInflow(balances, outflows);
    // inflow_05-02 = 1300 - 1000 + 200 = 500
    expect(result.get("acc1")?.get("2026-05-02")).toBe(500);
  });

  it("zero withdrawals → inflow = balance_D - balance_D-1", () => {
    const balances: BalanceRow[] = [
      { project_account_id: "acc1", date: "2026-05-01", balance_amount: 500 },
      { project_account_id: "acc1", date: "2026-05-02", balance_amount: 700 },
    ];
    const result = computeInflow(balances, []);
    expect(result.get("acc1")?.get("2026-05-02")).toBe(200);
  });

  it("D-1 missing (first row ever) → inflow is null", () => {
    const balances: BalanceRow[] = [
      { project_account_id: "acc1", date: "2026-05-01", balance_amount: 1000 },
    ];
    const result = computeInflow(balances, []);
    expect(result.get("acc1")?.get("2026-05-01")).toBeNull();
  });
});

describe("computeInflow — multi-day with gap", () => {
  it("gap between D-2 and D (skip D-1) uses last known balance as D-1", () => {
    const balances: BalanceRow[] = [
      { project_account_id: "acc1", date: "2026-05-01", balance_amount: 1000 },
      // 2026-05-02 is missing (no snapshot sent)
      { project_account_id: "acc1", date: "2026-05-03", balance_amount: 1500 },
    ];
    const outflows: TxOutflow[] = [
      { project_account_id: "acc1", date: "2026-05-03", total_outflow: 100 },
    ];
    const result = computeInflow(balances, outflows);
    // inflow_05-03 = 1500 - 1000 + 100 = 600 (uses last known balance)
    expect(result.get("acc1")?.get("2026-05-03")).toBe(600);
  });

  it("each day in a consecutive sequence gets correct inflow", () => {
    const balances: BalanceRow[] = [
      { project_account_id: "acc1", date: "2026-05-01", balance_amount: 1000 },
      { project_account_id: "acc1", date: "2026-05-02", balance_amount: 1200 },
      { project_account_id: "acc1", date: "2026-05-03", balance_amount: 900 },
    ];
    const outflows: TxOutflow[] = [
      { project_account_id: "acc1", date: "2026-05-02", total_outflow: 50 },
      { project_account_id: "acc1", date: "2026-05-03", total_outflow: 400 },
    ];
    const result = computeInflow(balances, outflows);
    // D=05-02: 1200 - 1000 + 50 = 250
    expect(result.get("acc1")?.get("2026-05-02")).toBe(250);
    // D=05-03: 900 - 1200 + 400 = 100
    expect(result.get("acc1")?.get("2026-05-03")).toBe(100);
  });
});

describe("computeInflow — multiple accounts", () => {
  it("accounts partitioned independently", () => {
    const balances: BalanceRow[] = [
      { project_account_id: "acc1", date: "2026-05-01", balance_amount: 1000 },
      { project_account_id: "acc1", date: "2026-05-02", balance_amount: 1100 },
      { project_account_id: "acc2", date: "2026-05-01", balance_amount: 500 },
      { project_account_id: "acc2", date: "2026-05-02", balance_amount: 600 },
    ];
    const result = computeInflow(balances, []);
    expect(result.get("acc1")?.get("2026-05-02")).toBe(100);
    expect(result.get("acc2")?.get("2026-05-02")).toBe(100);
    // first rows have no prior → null
    expect(result.get("acc1")?.get("2026-05-01")).toBeNull();
    expect(result.get("acc2")?.get("2026-05-01")).toBeNull();
  });
});

describe("computeInflow — edge cases", () => {
  it("empty balance rows → empty map", () => {
    const result = computeInflow([], []);
    expect(result.size).toBe(0);
  });

  it("outflow row with no matching balance row is ignored", () => {
    const balances: BalanceRow[] = [
      { project_account_id: "acc1", date: "2026-05-01", balance_amount: 1000 },
      { project_account_id: "acc1", date: "2026-05-02", balance_amount: 1000 },
    ];
    const outflows: TxOutflow[] = [
      { project_account_id: "acc-unknown", date: "2026-05-02", total_outflow: 999 },
    ];
    // acc1 inflow should not be affected
    const result = computeInflow(balances, outflows);
    expect(result.get("acc1")?.get("2026-05-02")).toBe(0);
  });
});

describe("computePerAccountInflow — missing-data detection", () => {
  it("both balances present → numeric result with no missingMessage", () => {
    const result = computePerAccountInflow(1300, 1000, 200);
    // (1300 - 1000) + 200 = 500
    expect(result).toEqual({ value: 500, missingMessage: null });
  });

  it("selectedDayBalance null → missingMessage ไม่มียอดคงเหลือวันที่เลือก", () => {
    const result = computePerAccountInflow(null, 1000, 200);
    expect(result).toEqual({ value: null, missingMessage: "ไม่มียอดคงเหลือวันที่เลือก" });
  });

  it("prevDayBalance null → missingMessage ไม่มียอดคงเหลือวันก่อนหน้า", () => {
    const result = computePerAccountInflow(1300, null, 200);
    expect(result).toEqual({ value: null, missingMessage: "ไม่มียอดคงเหลือวันก่อนหน้า" });
  });

  it("both null → missingMessage ไม่มียอดคงเหลือทั้งสองวัน", () => {
    const result = computePerAccountInflow(null, null, 200);
    expect(result).toEqual({ value: null, missingMessage: "ไม่มียอดคงเหลือทั้งสองวัน" });
  });

  it("equal balances, zero outflow → value is 0, not negative", () => {
    const result = computePerAccountInflow(1000, 1000, 0);
    expect(result).toEqual({ value: 0, missingMessage: null });
  });
});

describe("computePerAccountInflow — parking carve-out (ADR 0018)", () => {
  it("subtracts parkingIn from the balance-formula inflow", () => {
    // (1300 - 1000) + 200 - 150 = 350
    const result = computePerAccountInflow(1300, 1000, 200, 150);
    expect(result).toEqual({ value: 350, missingMessage: null });
  });

  it("parkingIn defaulting to 0 reproduces the pre-carve result", () => {
    expect(computePerAccountInflow(1300, 1000, 200)).toEqual({ value: 500, missingMessage: null });
  });

  it("parking exceeding the balance delta yields a negative value (not floored)", () => {
    // (30000 - 0) + 0 - 44188 = -14188 → surfaced as-is
    const result = computePerAccountInflow(30000, 0, 0, 44188);
    expect(result).toEqual({ value: -14188, missingMessage: null });
  });

  it("missing balance ignores parkingIn (still a missing-data message)", () => {
    expect(computePerAccountInflow(null, 1000, 200, 999)).toEqual({
      value: null,
      missingMessage: "ไม่มียอดคงเหลือวันที่เลือก",
    });
  });
});

describe("resolveAccountInflow (ADR 0016)", () => {
  const base = {
    reportSourced: false as boolean,
    gatewayInflow: null as number | null,
    selectedDayBalance: 1300,
    prevDayBalance: 1000,
    effectiveOutflow: 200,
  };

  it("non-report row falls back to the balance formula", () => {
    expect(resolveAccountInflow(base)).toEqual({ value: 500, missingMessage: null });
  });

  it("report-sourced row uses gatewayInflow, ignoring the balance delta", () => {
    const r = resolveAccountInflow({ ...base, reportSourced: true, gatewayInflow: 45000 });
    expect(r).toEqual({ value: 45000, missingMessage: null });
  });

  it("report-sourced row with no report → ไม่มีรายงาน", () => {
    const r = resolveAccountInflow({ ...base, reportSourced: true, gatewayInflow: null });
    expect(r.value).toBeNull();
    expect(r.missingMessage).toBe("ไม่มีรายงาน");
  });

  it("carves parkingIn for balance-formula rows", () => {
    // (1300 - 1000) + 200 - 100 = 400
    const r = resolveAccountInflow({ ...base, parkingIn: 100 });
    expect(r).toEqual({ value: 400, missingMessage: null });
  });

  it("ignores parkingIn for report-sourced (Apay) rows", () => {
    const r = resolveAccountInflow({ ...base, reportSourced: true, gatewayInflow: 45000, parkingIn: 9999 });
    expect(r).toEqual({ value: 45000, missingMessage: null });
  });
});

describe("computePerAccountInflow — internalIn carve (ADR 0020 §1)", () => {
  it("subtracts internalIn from the balance-formula inflow", () => {
    // (1300 - 1000) + 200 - 0 - 80 = 420
    const result = computePerAccountInflow(1300, 1000, 200, 0, 80);
    expect(result).toEqual({ value: 420, missingMessage: null });
  });

  it("internalIn defaults to 0 (existing results unchanged)", () => {
    expect(computePerAccountInflow(1300, 1000, 200)).toEqual({ value: 500, missingMessage: null });
  });

  it("internalIn composes with parkingIn", () => {
    // (1300 - 1000) + 200 - 50 - 80 = 370
    const result = computePerAccountInflow(1300, 1000, 200, 50, 80);
    expect(result).toEqual({ value: 370, missingMessage: null });
  });

  it("negative result when internalIn exceeds balance delta (not floored)", () => {
    const result = computePerAccountInflow(1000, 1000, 0, 0, 5000);
    expect(result).toEqual({ value: -5000, missingMessage: null });
  });

  it("missing balance still returns missingMessage ignoring internalIn", () => {
    const result = computePerAccountInflow(null, 1000, 200, 0, 999);
    expect(result.value).toBeNull();
    expect(result.missingMessage).toBe("ไม่มียอดคงเหลือวันที่เลือก");
  });
});

describe("resolveAccountInflow — internalIn carve (ADR 0020 §1)", () => {
  const base = {
    reportSourced: false as boolean,
    gatewayInflow: null as number | null,
    selectedDayBalance: 1300,
    prevDayBalance: 1000,
    effectiveOutflow: 200,
  };

  it("carves internalIn for balance-formula rows", () => {
    // (1300 - 1000) + 200 - 80 = 420
    const r = resolveAccountInflow({ ...base, internalIn: 80 });
    expect(r).toEqual({ value: 420, missingMessage: null });
  });

  it("internalIn defaults to 0 (unchanged behavior)", () => {
    expect(resolveAccountInflow(base)).toEqual({ value: 500, missingMessage: null });
  });

  it("ignores internalIn for report-sourced rows", () => {
    const r = resolveAccountInflow({ ...base, reportSourced: true, gatewayInflow: 45000, internalIn: 9999 });
    expect(r).toEqual({ value: 45000, missingMessage: null });
  });
});
