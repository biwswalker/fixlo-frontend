import { describe, it, expect } from "vitest";
import { crmReplyNormalize } from "../crmReplyNormalize";

// All Thai text here is SYNTHETIC canned-reply phrasing — no real customer PII.

describe("crmReplyNormalize", () => {
  it("returns empty for empty input", () => {
    expect(crmReplyNormalize("")).toBe("");
  });

  it("collapses emoji variants to one key", () => {
    const a = crmReplyNormalize("ยอดฝากเข้าแล้วนะคะ 🙏");
    const b = crmReplyNormalize("ยอดฝากเข้าแล้วนะคะ✨🎉");
    const c = crmReplyNormalize("ยอดฝากเข้าแล้วนะคะ");
    expect(a).toBe(c);
    expect(b).toBe(c);
  });

  it("collapses extra/interior whitespace to one key", () => {
    const spaced = crmReplyNormalize("ยอด  ฝาก เข้า แล้ว");
    const tight = crmReplyNormalize("ยอดฝากเข้าแล้ว");
    expect(spaced).toBe(tight);
  });

  it("collapses trailing politeness-particle variants to one key", () => {
    const kha = crmReplyNormalize("รอสักครู่กำลังตรวจสอบให้ค่ะ");
    const khrap = crmReplyNormalize("รอสักครู่กำลังตรวจสอบให้ครับ");
    const nakha = crmReplyNormalize("รอสักครู่กำลังตรวจสอบให้นะคะ");
    expect(kha).toBe(khrap);
    expect(kha).toBe(nakha);
  });

  it("collapses admin nickname/honorific signature variants to one key", () => {
    const plain = crmReplyNormalize("ยอดฝากเข้าแล้วค่ะ");
    const signedKhun = crmReplyNormalize("ยอดฝากเข้าแล้วค่ะ คุณมะปราง");
    const signedNong = crmReplyNormalize("ยอดฝากเข้าแล้วค่ะ น้องบี");
    expect(signedKhun).toBe(plain);
    expect(signedNong).toBe(plain);
  });

  it("collapses punctuation variants to one key", () => {
    const punct = crmReplyNormalize("ถอนเรียบร้อย!!! ~~~");
    const clean = crmReplyNormalize("ถอนเรียบร้อย");
    expect(punct).toBe(clean);
  });

  it("collapses a stack of decoration (emoji + particle + signature + punct)", () => {
    const decorated = crmReplyNormalize("ยอดฝากเข้าแล้วค่ะ 🙏✨ ... คุณมะปราง");
    const clean = crmReplyNormalize("ยอดฝากเข้าแล้ว");
    expect(decorated).toBe(clean);
  });

  it("keeps content-different replies distinct", () => {
    const deposit = crmReplyNormalize("ยอดฝากเข้าแล้วค่ะ");
    const credit = crmReplyNormalize("เครดิตเข้าแล้วค่ะ");
    const withdraw = crmReplyNormalize("ถอนเรียบร้อยค่ะ");
    expect(new Set([deposit, credit, withdraw]).size).toBe(3);
  });

  it("does not strip a content word that merely contains คุณ mid-phrase", () => {
    // "โอนให้คุณแล้ว" — คุณ = "you", not a signature (no preceding space).
    const key = crmReplyNormalize("โอนเงินให้คุณแล้ว");
    expect(key).toContain("คุณแล้ว");
  });

  it("lowercases Latin decoration so admin-name casing does not split keys", () => {
    const upper = crmReplyNormalize("รอแอดมินตรวจสอบ BeeR");
    const lower = crmReplyNormalize("รอแอดมินตรวจสอบ beer");
    expect(upper).toBe(lower);
  });
});
