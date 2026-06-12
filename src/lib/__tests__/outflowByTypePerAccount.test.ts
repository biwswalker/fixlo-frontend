import { describe, it, expect } from "vitest";
import { groupOutflowByAccount } from "@/lib/outflowByType";

describe("groupOutflowByAccount", () => {
  it("returns empty map for no rows", () => {
    expect(groupOutflowByAccount([])).toEqual(new Map());
  });

  it("groups by account_id and aggregates types", () => {
    const rows = [
      { account_id: "uuid-a", type_name: "ถอนให้ลูกค้า", effective_amount: 1000 },
      { account_id: "uuid-a", type_name: "ถอนให้ลูกค้า", effective_amount: 2000 },
      { account_id: "uuid-a", type_name: null, effective_amount: 500 },
      { account_id: "uuid-b", type_name: "รายจ่าย", effective_amount: 300 },
    ];
    const result = groupOutflowByAccount(rows);
    const a = result.get("uuid-a")!;
    expect(a.find((r) => r.typeName === "ถอนให้ลูกค้า")?.total).toBe(3000);
    expect(a.find((r) => r.typeName === "ไม่ระบุ")?.total).toBe(500);
    const b = result.get("uuid-b")!;
    expect(b).toHaveLength(1);
    expect(b[0]).toEqual({ typeName: "รายจ่าย", total: 300 });
  });

  it("skips rows with null account_id", () => {
    const rows = [
      { account_id: null, type_name: "รายจ่าย", effective_amount: 999 },
    ];
    expect(groupOutflowByAccount(rows)).toEqual(new Map());
  });
});
