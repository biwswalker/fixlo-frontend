import { describe, it, expect } from "vitest";
import { maskPhone, maskBankAccount, maskPii } from "../crmPiiMask";

describe("maskPhone", () => {
  it("keeps first 3 and last 2 digits", () => {
    expect(maskPhone("0802518587")).toBe("080-XXX-XX87");
  });
  it("strips non-digits before masking", () => {
    expect(maskPhone("080-251-8587")).toBe("080-XXX-XX87");
  });
  it("fully masks very short input", () => {
    expect(maskPhone("12")).toBe("••");
  });
});

describe("maskBankAccount", () => {
  it("reveals only the last 4", () => {
    expect(maskBankAccount("3029057951")).toBe("••••7951");
  });
  it("fully masks 4-or-fewer digits", () => {
    expect(maskBankAccount("951")).toBe("•••");
  });
});

describe("maskPii", () => {
  it("masks for junior (no crm.pii.full)", () => {
    expect(maskPii("0802518587", "phone_number", "junior")).toBe("080-XXX-XX87");
    expect(maskPii("3029057951", "bank_account", "junior")).toBe("••••7951");
  });
  it("returns full value for supervisor", () => {
    expect(maskPii("0802518587", "phone_number", "supervisor")).toBe("0802518587");
    expect(maskPii("3029057951", "bank_account", "supervisor")).toBe("3029057951");
  });
  it("masks when the role is missing (least privilege)", () => {
    expect(maskPii("0802518587", "phone_number", null)).toBe("080-XXX-XX87");
  });
  it("passes through null/empty", () => {
    expect(maskPii(null, "phone_number", "junior")).toBeNull();
    expect(maskPii("", "bank_account", "supervisor")).toBe("");
  });
});
