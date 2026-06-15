import { describe, it, expect } from "vitest";
import { computeCrossProjectOutflow, type CrossProjectOutflowRow } from "../crossProjectOutflow";

function row(overrides: Partial<CrossProjectOutflowRow> & { effective_amount: number }): CrossProjectOutflowRow {
  return {
    source_project_name: "juno168",
    target_project_name: "uno",
    account_id: "acc-a",
    account_name: "SCB Master",
    type_name: "ถอนให้ลูกค้า",
    is_internal_transfer: false,
    ...overrides,
  };
}

describe("computeCrossProjectOutflow — grouping", () => {
  it("empty input → empty result", () => {
    expect(computeCrossProjectOutflow([])).toHaveLength(0);
  });

  it("single row → one group with correct fields", () => {
    const [g] = computeCrossProjectOutflow([row({ effective_amount: 1000 })]);
    expect(g.targetProject).toBe("uno");
    expect(g.sourceAccount).toBe("SCB Master");
    expect(g.kind).toBe("ถอนให้ลูกค้า");
    expect(g.total).toBe(1000);
    expect(g.count).toBe(1);
  });

  it("two rows same (target × account × kind) → merged into one group", () => {
    const rows = [
      row({ effective_amount: 500 }),
      row({ effective_amount: 300 }),
    ];
    const result = computeCrossProjectOutflow(rows);
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(800);
    expect(result[0].count).toBe(2);
  });

  it("different targets → separate groups", () => {
    const rows = [
      row({ effective_amount: 500, target_project_name: "uno" }),
      row({ effective_amount: 300, target_project_name: "gaza" }),
    ];
    const result = computeCrossProjectOutflow(rows);
    expect(result).toHaveLength(2);
    expect(result.find((g) => g.targetProject === "uno")?.total).toBe(500);
    expect(result.find((g) => g.targetProject === "gaza")?.total).toBe(300);
  });

  it("different accounts → separate groups", () => {
    const rows = [
      row({ effective_amount: 500, account_id: "acc-a", account_name: "SCB Master" }),
      row({ effective_amount: 300, account_id: "acc-b", account_name: "KBANK Master" }),
    ];
    const result = computeCrossProjectOutflow(rows);
    expect(result).toHaveLength(2);
  });

  it("different kinds → separate groups", () => {
    const rows = [
      row({ effective_amount: 500, is_internal_transfer: true, type_name: null }),
      row({ effective_amount: 300, is_internal_transfer: false, type_name: "ถอนให้ลูกค้า" }),
    ];
    const result = computeCrossProjectOutflow(rows);
    expect(result).toHaveLength(2);
    expect(result.find((g) => g.kind === "โยกทุน")?.total).toBe(500);
    expect(result.find((g) => g.kind === "ถอนให้ลูกค้า")?.total).toBe(300);
  });
});

describe("computeCrossProjectOutflow — kind resolution", () => {
  it("is_internal_transfer=true → kind='โยกทุน'", () => {
    const [g] = computeCrossProjectOutflow([
      row({ effective_amount: 1000, is_internal_transfer: true, type_name: null }),
    ]);
    expect(g.kind).toBe("โยกทุน");
  });

  it("is_internal_transfer=true overrides type_name", () => {
    const [g] = computeCrossProjectOutflow([
      row({ effective_amount: 1000, is_internal_transfer: true, type_name: "ถอนให้ลูกค้า" }),
    ]);
    expect(g.kind).toBe("โยกทุน");
  });

  it("is_internal_transfer=false with type_name → uses type_name", () => {
    const [g] = computeCrossProjectOutflow([
      row({ effective_amount: 500, is_internal_transfer: false, type_name: "ถอนให้ลูกค้า" }),
    ]);
    expect(g.kind).toBe("ถอนให้ลูกค้า");
  });

  it("is_internal_transfer=false with null type_name → 'ไม่ระบุประเภท'", () => {
    const [g] = computeCrossProjectOutflow([
      row({ effective_amount: 500, is_internal_transfer: false, type_name: null }),
    ]);
    expect(g.kind).toBe("ไม่ระบุประเภท");
  });
});

describe("computeCrossProjectOutflow — unmatched account bucket", () => {
  it("null account_id → sourceAccount='ยังไม่จับคู่บัญชี'", () => {
    const [g] = computeCrossProjectOutflow([
      row({ effective_amount: 500, account_id: null, account_name: null }),
    ]);
    expect(g.sourceAccount).toBe("ยังไม่จับคู่บัญชี");
  });

  it("multiple unmatched rows group by kind+target", () => {
    const rows = [
      row({ effective_amount: 300, account_id: null, account_name: null }),
      row({ effective_amount: 200, account_id: null, account_name: null }),
    ];
    const result = computeCrossProjectOutflow(rows);
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(500);
    expect(result[0].sourceAccount).toBe("ยังไม่จับคู่บัญชี");
  });
});

describe("computeCrossProjectOutflow — null target is same-project, skipped (ADR 0020 §5 amended)", () => {
  it("null target → row skipped (no 'ไม่ระบุโปรเจกต์' bucket)", () => {
    const result = computeCrossProjectOutflow([
      row({ effective_amount: 500, target_project_name: null }),
    ]);
    expect(result).toHaveLength(0);
  });

  it("mix of resolved and null targets → only resolved survive", () => {
    const rows = [
      row({ effective_amount: 500, target_project_name: "uno" }),
      row({ effective_amount: 300, target_project_name: null }),
    ];
    const result = computeCrossProjectOutflow(rows);
    expect(result).toHaveLength(1);
    expect(result[0].targetProject).toBe("uno");
  });
});

describe("computeCrossProjectOutflow — all-mode source dimension", () => {
  it("isAllMode=false → no sourceProject field", () => {
    const [g] = computeCrossProjectOutflow([row({ effective_amount: 500 })], false);
    expect(g.sourceProject).toBeUndefined();
  });

  it("isAllMode=true → sourceProject set", () => {
    const [g] = computeCrossProjectOutflow([row({ effective_amount: 500 })], true);
    expect(g.sourceProject).toBe("juno168");
  });

  it("isAllMode=true different source projects → separate groups", () => {
    const rows = [
      row({ effective_amount: 500, source_project_name: "juno168" }),
      row({ effective_amount: 300, source_project_name: "uno" }),
    ];
    const result = computeCrossProjectOutflow(rows, true);
    expect(result).toHaveLength(2);
    expect(result.find((g) => g.sourceProject === "juno168")?.total).toBe(500);
    expect(result.find((g) => g.sourceProject === "uno")?.total).toBe(300);
  });

  it("isAllMode=true same source → merged", () => {
    const rows = [
      row({ effective_amount: 500, source_project_name: "juno168" }),
      row({ effective_amount: 200, source_project_name: "juno168" }),
    ];
    const result = computeCrossProjectOutflow(rows, true);
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(700);
  });
});

describe("computeCrossProjectOutflow — amount", () => {
  it("effective_amount as string is parsed", () => {
    const [g] = computeCrossProjectOutflow([
      { ...row({ effective_amount: 0 }), effective_amount: "1234.56" as unknown as number },
    ]);
    expect(g.total).toBeCloseTo(1234.56);
  });
});

describe("computeCrossProjectOutflow — display ordering (contiguous groups for rowspan)", () => {
  it("target groups ordered by descending group sum, rows contiguous", () => {
    const rows = [
      row({ effective_amount: 100, target_project_name: "uno", account_id: "a", account_name: "A" }),
      row({ effective_amount: 900, target_project_name: "gaza", account_id: "b", account_name: "B" }),
      row({ effective_amount: 50, target_project_name: "uno", account_id: "c", account_name: "C" }),
    ];
    const result = computeCrossProjectOutflow(rows);
    // uno sum=150, gaza sum=900 → gaza group first, then both uno rows contiguous
    expect(result.map((g) => g.targetProject)).toEqual(["gaza", "uno", "uno"]);
  });

  it("within a target group, rows ordered by descending total", () => {
    const rows = [
      row({ effective_amount: 50, target_project_name: "uno", account_id: "a", account_name: "A" }),
      row({ effective_amount: 100, target_project_name: "uno", account_id: "c", account_name: "C" }),
    ];
    const result = computeCrossProjectOutflow(rows);
    expect(result.map((g) => g.total)).toEqual([100, 50]);
  });

  it("group sum (not single row total) decides group order", () => {
    const rows = [
      // gaza: one 500 row
      row({ effective_amount: 500, target_project_name: "gaza", account_id: "g", account_name: "G" }),
      // uno: two rows summing 550, each below 500
      row({ effective_amount: 300, target_project_name: "uno", account_id: "a", account_name: "A" }),
      row({ effective_amount: 250, target_project_name: "uno", account_id: "c", account_name: "C" }),
    ];
    const result = computeCrossProjectOutflow(rows);
    // uno sum 550 > gaza 500 → uno group first despite gaza having the biggest single row
    expect(result.map((g) => g.targetProject)).toEqual(["uno", "uno", "gaza"]);
  });

  it("rows of the same target stay contiguous even when another group interleaves by total", () => {
    const rows = [
      row({ effective_amount: 300, target_project_name: "uno", account_id: "a", account_name: "A" }),
      row({ effective_amount: 250, target_project_name: "gaza", account_id: "g", account_name: "G" }),
      row({ effective_amount: 200, target_project_name: "uno", account_id: "c", account_name: "C" }),
    ];
    const result = computeCrossProjectOutflow(rows);
    // uno sum 500 > gaza 250 → both uno rows first and contiguous, then gaza
    expect(result.map((g) => g.targetProject)).toEqual(["uno", "uno", "gaza"]);
  });

  it("all-mode: ordered by source group then target group, rows contiguous", () => {
    const rows = [
      row({ effective_amount: 100, source_project_name: "juno168", target_project_name: "uno", account_id: "a", account_name: "A" }),
      row({ effective_amount: 900, source_project_name: "alpha", target_project_name: "gaza", account_id: "b", account_name: "B" }),
      row({ effective_amount: 80, source_project_name: "juno168", target_project_name: "uno", account_id: "c", account_name: "C" }),
    ];
    const result = computeCrossProjectOutflow(rows, true);
    // alpha sum=900 > juno168 sum=180 → alpha source group first, juno168 rows contiguous
    expect(result.map((g) => g.sourceProject)).toEqual(["alpha", "juno168", "juno168"]);
    expect(result.map((g) => g.targetProject)).toEqual(["gaza", "uno", "uno"]);
  });
});
