import { describe, it, expect } from "vitest";
import { aggregateOutflowByType } from "@/lib/outflowByType";

describe("aggregateOutflowByType", () => {
  it("returns empty array for no rows", () => {
    expect(aggregateOutflowByType([])).toEqual([]);
  });

  it("groups by type name and sums amounts", () => {
    const rows = [
      { type_name: "ถอนให้ลูกค้า", effective_amount: 1000 },
      { type_name: "ถอนให้ลูกค้า", effective_amount: 2000 },
      { type_name: "รายจ่าย", effective_amount: 500 },
    ];
    const result = aggregateOutflowByType(rows);
    expect(result.find((r) => r.typeName === "ถอนให้ลูกค้า")?.total).toBe(3000);
    expect(result.find((r) => r.typeName === "รายจ่าย")?.total).toBe(500);
  });

  it("buckets null type_name as ไม่ระบุ", () => {
    const rows = [
      { type_name: null, effective_amount: 800 },
      { type_name: null, effective_amount: 200 },
    ];
    const result = aggregateOutflowByType(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ typeName: "ไม่ระบุ", total: 1000 });
  });

  it("sorts by total descending", () => {
    const rows = [
      { type_name: "รายจ่าย", effective_amount: 100 },
      { type_name: "ถอนให้ลูกค้า", effective_amount: 5000 },
      { type_name: null, effective_amount: 200 },
    ];
    const result = aggregateOutflowByType(rows);
    expect(result[0].total).toBeGreaterThanOrEqual(result[1].total);
    expect(result[1].total).toBeGreaterThanOrEqual(result[2].total);
  });

  it("single untyped row", () => {
    const rows = [{ type_name: null, effective_amount: 999 }];
    expect(aggregateOutflowByType(rows)).toEqual([{ typeName: "ไม่ระบุ", total: 999 }]);
  });

  it("mixed typed and untyped", () => {
    const rows = [
      { type_name: "โอนไบแนน", effective_amount: 3000 },
      { type_name: null, effective_amount: 1500 },
      { type_name: "โอนไบแนน", effective_amount: 1000 },
    ];
    const result = aggregateOutflowByType(rows);
    expect(result.find((r) => r.typeName === "โอนไบแนน")?.total).toBe(4000);
    expect(result.find((r) => r.typeName === "ไม่ระบุ")?.total).toBe(1500);
  });
});
