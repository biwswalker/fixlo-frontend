import { describe, it, expect } from "vitest";
import { resolveTypeId } from "@/lib/classifySlipNote";

const TYPES = [
  { id: 1, name: "ถอนให้ลูกค้า" },
  { id: 2, name: "โอนไบแนน" },
  { id: 3, name: "รายจ่าย" },
];

describe("resolveTypeId", () => {
  it("returns id for exact match", () => {
    expect(resolveTypeId("ถอนให้ลูกค้า", TYPES)).toBe(1);
    expect(resolveTypeId("โอนไบแนน", TYPES)).toBe(2);
    expect(resolveTypeId("รายจ่าย", TYPES)).toBe(3);
  });

  it("trims whitespace before matching", () => {
    expect(resolveTypeId("  ถอนให้ลูกค้า  ", TYPES)).toBe(1);
  });

  it("returns null for unknown type name", () => {
    expect(resolveTypeId("ไม่รู้จัก", TYPES)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(resolveTypeId(null, TYPES)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(resolveTypeId("", TYPES)).toBeNull();
  });

  it("returns null when available types list is empty", () => {
    expect(resolveTypeId("ถอนให้ลูกค้า", [])).toBeNull();
  });
});
