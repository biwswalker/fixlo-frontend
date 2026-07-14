import { describe, it, expect } from "vitest";
import {
  classifySensitivity,
  deriveIntentName,
  annotateCandidate,
  type SensitivityInput,
} from "../crmSensitivityHeuristic";

// SYNTHETIC data only — no real customer PII. Replies/utterances below are
// fabricated canned messages that exercise the money/complaint vs collect-info
// boundary.
const c = (
  targetResponse: string,
  sampleUtterances: string[] = [],
): SensitivityInput => ({ targetResponse, sampleUtterances });

describe("classifySensitivity — money/complaint → sensitive/force_human", () => {
  it("marks a deposit-confirmation reply sensitive", () => {
    const r = classifySensitivity(c("ยอดฝากเข้าแล้วนะคะ"));
    expect(r.isSensitive).toBe(true);
    expect(r.responsePolicy).toBe("force_human");
  });

  it.each([
    ["ถอน", "ดำเนินการถอนให้แล้วค่ะ"],
    ["เครดิต", "เติมเครดิตให้แล้วนะคะ"],
    ["โอน", "โอนคืนให้เรียบร้อยแล้วค่ะ"],
    ["ช้า (complaint)", "ต้องขออภัยที่ทำรายการช้าค่ะ"],
    ["ไม่เข้า", "ตรวจสอบแล้วยอดยังไม่เข้าระบบค่ะ"],
    ["ผิด", "ขออภัยที่โอนผิดบัญชีค่ะ"],
    ["ร้องเรียน", "รับเรื่องร้องเรียนไว้แล้วค่ะ"],
  ])("marks %s reply sensitive → force_human", (_label, reply) => {
    const r = classifySensitivity(c(reply));
    expect(r.isSensitive).toBe(true);
    expect(r.responsePolicy).toBe("force_human");
  });

  it("flags sensitive from a money term in an utterance even if the reply is neutral", () => {
    const r = classifySensitivity(c("รอสักครู่นะคะ", ["ถอนเงินยังไม่เข้าเลยค่ะ"]));
    expect(r.isSensitive).toBe(true);
    expect(r.responsePolicy).toBe("force_human");
  });
});

describe("classifySensitivity — collect-info → non-sensitive/copilot_suggest", () => {
  it("keeps a name/phone/account request non-sensitive", () => {
    const r = classifySensitivity(c("รบกวนแจ้งชื่อ-เบอร์-เลขบัญชีค่ะ"));
    expect(r.isSensitive).toBe(false);
    expect(r.responsePolicy).toBe("copilot_suggest");
  });

  it("keeps บัญชี in an info-request context non-sensitive even with ฝาก in the field name", () => {
    // "ขอเลขบัญชีฝาก" = asking for the DEPOSIT-ACCOUNT number (a field), not a
    // deposit transaction.
    const r = classifySensitivity(c("ขอเลขบัญชีฝากด้วยค่ะ"));
    expect(r.isSensitive).toBe(false);
    expect(r.responsePolicy).toBe("copilot_suggest");
  });

  it("keeps a username/password login-info request non-sensitive", () => {
    const r = classifySensitivity(c("รบกวนแจ้งยูสเซอร์และรหัสผ่านค่ะ"));
    expect(r.isSensitive).toBe(false);
    expect(r.responsePolicy).toBe("copilot_suggest");
  });
});

describe("classifySensitivity — boundary/ambiguous cases", () => {
  it("stays sensitive when an info request also reports a balance (ยอด is a strong signal)", () => {
    const r = classifySensitivity(c("ยอดถอนกำลังดำเนินการ รบกวนแจ้งเลขบัญชีค่ะ"));
    expect(r.isSensitive).toBe(true);
    expect(r.responsePolicy).toBe("force_human");
  });

  it("stays sensitive when a request pairs with a complaint term (ช้า)", () => {
    const r = classifySensitivity(c("ขออภัยที่ช้า รบกวนแจ้งเลขบัญชีอีกครั้งค่ะ"));
    expect(r.isSensitive).toBe(true);
  });

  it("treats a benign non-money reply as non-sensitive", () => {
    const r = classifySensitivity(c("รอสักครู่นะคะ กำลังตรวจสอบให้ค่ะ"));
    expect(r.isSensitive).toBe(false);
    expect(r.responsePolicy).toBe("copilot_suggest");
  });

  it("treats an empty reply with no signals as non-sensitive", () => {
    const r = classifySensitivity(c(""));
    expect(r.isSensitive).toBe(false);
    expect(r.responsePolicy).toBe("copilot_suggest");
  });
});

describe("deriveIntentName", () => {
  it("takes the leading clause and drops a trailing politeness particle", () => {
    expect(deriveIntentName(c("ยอดฝากเข้าแล้วนะคะ"))).toBe("ยอดฝากเข้าแล้ว");
  });

  it("cuts at the first clause boundary", () => {
    expect(deriveIntentName(c("รอสักครู่นะคะ กำลังตรวจสอบให้ค่ะ"))).toBe(
      "รอสักครู่",
    );
  });

  it("uses only the first line of a multi-line reply", () => {
    expect(deriveIntentName(c("แจ้งเลขบัญชี\nกสิกรไทย 1234567890"))).toBe(
      "แจ้งเลขบัญชี",
    );
  });

  it("caps an over-long single clause and appends an ellipsis", () => {
    const long = "ก".repeat(40);
    const name = deriveIntentName(c(long));
    expect(name.length).toBe(30);
    expect(name.endsWith("…")).toBe(true);
  });

  it("falls back to a generic label for an empty reply", () => {
    expect(deriveIntentName(c(""))).toBe("ไม่ระบุ");
    expect(deriveIntentName(c("   \n  "))).toBe("ไม่ระบุ");
  });

  it("is deterministic across calls", () => {
    const input = c("ยอดฝากเข้าแล้วนะคะ");
    expect(deriveIntentName(input)).toBe(deriveIntentName(input));
  });
});

describe("annotateCandidate", () => {
  it("bundles intent name, sensitivity, and policy for a sensitive candidate", () => {
    expect(annotateCandidate(c("ยอดฝากเข้าแล้วนะคะ"))).toEqual({
      intentName: "ยอดฝากเข้าแล้ว",
      isSensitive: true,
      responsePolicy: "force_human",
    });
  });

  it("bundles annotation for a collect-info candidate", () => {
    expect(annotateCandidate(c("รบกวนแจ้งชื่อ-เบอร์-เลขบัญชีค่ะ"))).toEqual({
      intentName: "รบกวนแจ้งชื่อ-เบอร์-เลขบัญชี",
      isSensitive: false,
      responsePolicy: "copilot_suggest",
    });
  });
});
