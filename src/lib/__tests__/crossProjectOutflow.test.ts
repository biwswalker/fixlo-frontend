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
    slip_note: null,
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

describe("computeCrossProjectOutflow — unresolved project bucket", () => {
  it("null target with slip_note → targetProject='ไม่ระบุโปรเจกต์' with rawNote", () => {
    const [g] = computeCrossProjectOutflow([
      row({ effective_amount: 500, target_project_name: null, slip_note: "ถอนให้ลูกค้า uno" }),
    ]);
    expect(g.targetProject).toBe("ไม่ระบุโปรเจกต์");
    expect(g.rawNote).toBe("ถอนให้ลูกค้า uno");
  });

  it("null target without slip_note → row skipped", () => {
    const result = computeCrossProjectOutflow([
      row({ effective_amount: 500, target_project_name: null, slip_note: null }),
    ]);
    expect(result).toHaveLength(0);
  });

  it("null target with empty slip_note → row skipped", () => {
    const result = computeCrossProjectOutflow([
      row({ effective_amount: 500, target_project_name: null, slip_note: "" }),
    ]);
    expect(result).toHaveLength(0);
  });

  it("different notes → separate groups", () => {
    const rows = [
      row({ effective_amount: 500, target_project_name: null, slip_note: "ถอนให้ลูกค้า uno" }),
      row({ effective_amount: 300, target_project_name: null, slip_note: "ถอนให้ลูกค้า gaza" }),
    ];
    const result = computeCrossProjectOutflow(rows);
    expect(result).toHaveLength(2);
  });

  it("same note → merged", () => {
    const rows = [
      row({ effective_amount: 500, target_project_name: null, slip_note: "ถอนให้ลูกค้า uno" }),
      row({ effective_amount: 300, target_project_name: null, slip_note: "ถอนให้ลูกค้า uno" }),
    ];
    const result = computeCrossProjectOutflow(rows);
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(800);
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

  it("sorted by total descending", () => {
    const rows = [
      row({ effective_amount: 100, target_project_name: "uno" }),
      row({ effective_amount: 900, target_project_name: "gaza" }),
    ];
    const result = computeCrossProjectOutflow(rows);
    expect(result[0].total).toBe(900);
    expect(result[1].total).toBe(100);
  });
});
