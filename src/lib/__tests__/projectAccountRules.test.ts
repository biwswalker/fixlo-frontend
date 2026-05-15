import { describe, it, expect } from "vitest";
import { canSoftDelete } from "../projectAccountRules";

describe("canSoftDelete — no mapped transactions", () => {
  it("0 mapped transactions → allowed", () => {
    expect(canSoftDelete(0)).toEqual({ allowed: true });
  });
});

describe("canSoftDelete — has mapped transactions", () => {
  it("1 mapped transaction → blocked with reason", () => {
    const result = canSoftDelete(1);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBeTruthy();
    }
  });

  it("many mapped transactions → blocked", () => {
    expect(canSoftDelete(10).allowed).toBe(false);
  });
});
