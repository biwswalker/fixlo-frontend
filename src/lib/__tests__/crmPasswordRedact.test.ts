import { describe, it, expect } from "vitest";
import { redactPasswords, containsPassword } from "../crmPasswordRedact";

describe("redactPasswords", () => {
  it("redacts a Thai password label token", () => {
    expect(redactPasswords("รหัสผ่าน Niiza1122")).toBe("รหัสผ่าน [REDACTED]");
  });

  it("redacts English password labels", () => {
    expect(redactPasswords("password: hunter2")).toBe("password: [REDACTED]");
    expect(redactPasswords("pwd=abc123")).toContain("[REDACTED]");
  });

  it("redacts within a larger message", () => {
    const out = redactPasswords("ยูส 0802518587 รหัสผ่าน Niiza1122");
    expect(out).toBe("ยูส 0802518587 รหัสผ่าน [REDACTED]");
  });

  it("tolerates the bare word รหัส (promo codes untouched)", () => {
    expect(redactPasswords("รหัสโปรโมชั่น SAVE5")).toBe("รหัสโปรโมชั่น SAVE5");
  });

  it("leaves non-password text unchanged", () => {
    expect(redactPasswords("ขอเลขบัญชีฝากค่ะ")).toBe("ขอเลขบัญชีฝากค่ะ");
  });

  it("handles empty input", () => {
    expect(redactPasswords("")).toBe("");
  });
});

describe("containsPassword", () => {
  it("detects a password token", () => {
    expect(containsPassword("รหัสผ่าน Niiza1122")).toBe(true);
  });
  it("is false for plain text and promo codes", () => {
    expect(containsPassword("รหัสโปรโมชั่น SAVE5")).toBe(false);
    expect(containsPassword("สวัสดีค่ะ")).toBe(false);
  });
});
