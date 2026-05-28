import { describe, it, expect } from "vitest";
import { withEditAudit, withDeleteAudit } from "../auditFields";

describe("withEditAudit", () => {
  it("stamps last_edited_by and last_edited_at onto payload", () => {
    const payload = { amount: 1000 };
    const result = withEditAudit(payload, { by: "admin@fixlo.io" });
    expect(result.amount).toBe(1000);
    expect(result.last_edited_by).toBe("admin@fixlo.io");
    expect(result.last_edited_at).toBeInstanceOf(Date);
  });

  it("stamps optional last_edited_note when provided", () => {
    const result = withEditAudit({}, { by: "user", note: "typo fix" });
    expect(result.last_edited_note).toBe("typo fix");
  });

  it("omits last_edited_note when not provided", () => {
    const result = withEditAudit({}, { by: "user" });
    expect("last_edited_note" in result).toBe(false);
  });

  it("does not mutate the original payload", () => {
    const original = { amount: 500 };
    withEditAudit(original, { by: "user" });
    expect(Object.keys(original)).toEqual(["amount"]);
  });

  it("last_edited_at is recent (within 5 seconds)", () => {
    const before = new Date();
    const result = withEditAudit({}, { by: "u" });
    const after = new Date();
    expect(result.last_edited_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.last_edited_at.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("withDeleteAudit", () => {
  it("returns deleted_at, deleted_by, delete_reason", () => {
    const result = withDeleteAudit({ by: "admin@fixlo.io", reason: "wrong slip" });
    expect(result.deleted_by).toBe("admin@fixlo.io");
    expect(result.deleted_at).toBeInstanceOf(Date);
    expect(result.delete_reason).toBe("wrong slip");
  });

  it("deleted_at is recent", () => {
    const before = new Date();
    const result = withDeleteAudit({ by: "u", reason: "test" });
    const after = new Date();
    expect(result.deleted_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.deleted_at.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("reason is captured exactly", () => {
    const result = withDeleteAudit({ by: "u", reason: "กรอกผิด" });
    expect(result.delete_reason).toBe("กรอกผิด");
  });
});
