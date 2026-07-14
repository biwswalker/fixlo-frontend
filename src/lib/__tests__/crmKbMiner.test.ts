import { describe, it, expect } from "vitest";
import { mineIntentCandidates } from "../crmKbMiner";
import type { ChatMessage, SenderType } from "../crmChatCsvParse";

// SYNTHETIC data only — no real customer PII. `CUST` is a fake phone-like id,
// admins use fake nicknames. Timestamps are +07:00 (LINE OA export offset).
const CUST = "0800000000";
const GAP = 360; // 6h, the CRM default

function m(
  senderType: SenderType,
  senderName: string,
  at: string,
  text: string,
): ChatMessage {
  return { senderType, senderName, at, text };
}

const cust = (at: string, text: string) => m("customer", CUST, at, text);
const admin = (at: string, text: string, who = "แอดมินเอ") =>
  m("admin", who, at, text);
const bot = (at: string, text: string) =>
  m("bot", "ข้อความตอบกลับอัตโนมัติ", at, text);

describe("mineIntentCandidates", () => {
  it("returns an empty array for no messages", () => {
    expect(mineIntentCandidates([], { gapMinutes: GAP })).toEqual([]);
  });

  it("groups a reply recurring after different customer bursts into one candidate", () => {
    const out = mineIntentCandidates(
      [
        cust("2026-04-16T10:00:00+07:00", "ฝากเงินยังไม่เข้าเลยค่ะ"),
        admin("2026-04-16T10:05:00+07:00", "ยอดฝากเข้าแล้วนะคะ"),
        // >6h later → a new session, same canned reply (decoration variant)
        cust("2026-04-16T17:30:00+07:00", "ฝากเข้าช้าจังเลย"),
        admin("2026-04-16T17:35:00+07:00", "ยอดฝากเข้าแล้วค่ะ"),
      ],
      { gapMinutes: GAP },
    );
    expect(out).toHaveLength(1);
    expect(out[0].occurrences).toBe(2);
    expect(out[0].sampleUtterances).toEqual([
      "ฝากเงินยังไม่เข้าเลยค่ะ",
      "ฝากเข้าช้าจังเลย",
    ]);
  });

  it("collects the contiguous pre-reply block, noise-filtered and de-duped", () => {
    const out = mineIntentCandidates(
      [
        cust("2026-04-16T10:00:00+07:00", "คุณส่งรูป"), // image placeholder → noise
        cust("2026-04-16T10:01:00+07:00", "ถอนเงินยังไม่เข้าเลยค่ะ"),
        cust("2026-04-16T10:02:00+07:00", "ถอนเงินยังไม่เข้าเลยค่ะ"), // duplicate
        admin("2026-04-16T10:05:00+07:00", "รอสักครู่นะคะกำลังตรวจสอบให้"),
      ],
      { gapMinutes: GAP },
    );
    expect(out).toHaveLength(1);
    expect(out[0].sampleUtterances).toEqual(["ถอนเงินยังไม่เข้าเลยค่ะ"]);
  });

  it("lets a bot turn break the contiguous customer block", () => {
    const out = mineIntentCandidates(
      [
        cust("2026-04-16T10:00:00+07:00", "ถามเรื่องโปรโมชั่นค่ะ"),
        bot("2026-04-16T10:00:30+07:00", "สวัสดีค่ะ ยินดีต้อนรับ"),
        cust("2026-04-16T10:01:00+07:00", "ยอดเครดิตหายไปค่ะ"),
        admin("2026-04-16T10:05:00+07:00", "เดี๋ยวตรวจสอบให้นะคะ"),
      ],
      { gapMinutes: GAP },
    );
    expect(out).toHaveLength(1);
    // The pre-bot message is not part of the block; only the post-bot one is.
    expect(out[0].sampleUtterances).toEqual(["ยอดเครดิตหายไปค่ะ"]);
  });

  it("keeps the most frequent raw variant as targetResponse", () => {
    const out = mineIntentCandidates(
      [
        cust("2026-04-16T09:00:00+07:00", "ฝากแล้วยอดยังไม่ขึ้นค่ะ"),
        admin("2026-04-16T09:05:00+07:00", "ยอดฝากเข้าแล้วค่ะ"), // X
        cust("2026-04-16T16:00:00+07:00", "ฝากอีกรอบไม่เข้าค่ะ"),
        admin("2026-04-16T16:05:00+07:00", "ยอดฝากเข้าแล้วนะคะ"), // Y
        cust("2026-04-16T23:30:00+07:00", "ฝากเงินเข้าช้ามากค่ะ"),
        admin("2026-04-16T23:35:00+07:00", "ยอดฝากเข้าแล้วค่ะ"), // X again
      ],
      { gapMinutes: GAP },
    );
    expect(out).toHaveLength(1);
    expect(out[0].occurrences).toBe(3);
    expect(out[0].targetResponse).toBe("ยอดฝากเข้าแล้วค่ะ");
  });

  it("respects the session gap boundary when pairing utterances", () => {
    const out = mineIntentCandidates(
      [
        // A message from a prior session (>6h before the reply's session)…
        cust("2026-04-16T08:00:00+07:00", "ข้อความเก่าจากเมื่อวานค่ะ"),
        // …then a new session's customer message, then the reply.
        cust("2026-04-16T18:00:00+07:00", "ฝากเงินไม่เข้าค่ะ"),
        admin("2026-04-16T18:05:00+07:00", "ยอดฝากเข้าแล้วนะคะ"),
      ],
      { gapMinutes: GAP },
    );
    expect(out).toHaveLength(1);
    // Only the same-session message is an utterance; the old one is excluded.
    expect(out[0].sampleUtterances).toEqual(["ฝากเงินไม่เข้าค่ะ"]);
  });

  it("skips an admin reply with no preceding customer messages", () => {
    const out = mineIntentCandidates(
      [
        admin("2026-04-16T10:00:00+07:00", "สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ"),
        bot("2026-04-16T10:00:10+07:00", "ระบบอัตโนมัติ"),
      ],
      { gapMinutes: GAP },
    );
    expect(out).toEqual([]);
  });
});
