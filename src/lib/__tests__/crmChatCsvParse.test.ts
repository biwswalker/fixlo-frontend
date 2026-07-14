import { describe, it, expect } from "vitest";
import { parseChatCsv, maskNumbers } from "../crmChatCsvParse";

// A compact but faithful slice of the LINE OA export format: BOM, three
// metadata rows, the column header, then data rows including a multi-line
// quoted message and each sender kind.
const SAMPLE =
  "﻿ชื่อบัญชี,JUNO168 VVIP\n" +
  "ไทม์โซน,'+07:00\n" +
  "วันดาวน์โหลด,2026/07/06 15:33\n" +
  "ประเภทผู้ส่ง,ชื่อผู้ส่ง,วันส่ง,เวลาส่ง,ข้อความ\n" +
  "Account,ข้อความตอบกลับอัตโนมัติ,2026/04/16,13:15:28,เว็บตรงลิขสิทธิ์แท้\n" +
  'Account,ข้อความตอบกลับอัตโนมัติ,2026/04/16,13:15:28,"สวัสดี คุณ ยูยู\nยินดีต้อนรับ\n\nขอบคุณค่ะ"\n' +
  "User,0802518587,2026/04/16,13:15:41,ถอนนานมากเลยค่ะ\n" +
  "Account,อุ๋มอิ๋ม,2026/04/16,14:43:00,ยอดฝากเข้าแล้วนะคะ\n";

describe("parseChatCsv", () => {
  it("skips metadata and column-header rows", () => {
    const msgs = parseChatCsv(SAMPLE);
    // 4 data rows only; none of the header/metadata rows leak through.
    expect(msgs).toHaveLength(4);
    expect(msgs.map((m) => m.text)).not.toContain("JUNO168 VVIP");
    expect(msgs.map((m) => m.senderName)).not.toContain("ชื่อผู้ส่ง");
  });

  it("keeps a multi-line quoted message intact as one record", () => {
    const msgs = parseChatCsv(SAMPLE);
    const multi = msgs[1];
    expect(multi.text).toBe("สวัสดี คุณ ยูยู\nยินดีต้อนรับ\n\nขอบคุณค่ะ");
  });

  it("maps User to customer", () => {
    const msg = parseChatCsv(SAMPLE).find((m) => m.text.includes("ถอนนาน"))!;
    expect(msg.senderType).toBe("customer");
  });

  it("maps Account + auto-reply name to bot", () => {
    const msgs = parseChatCsv(SAMPLE).filter((m) => m.senderType === "bot");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].senderName).toBe("ข้อความตอบกลับอัตโนมัติ");
  });

  it("maps Account + a nickname to admin", () => {
    const msg = parseChatCsv(SAMPLE).find((m) => m.text.includes("ยอดฝาก"))!;
    expect(msg.senderType).toBe("admin");
    expect(msg.senderName).toBe("อุ๋มอิ๋ม");
  });

  it("builds an ISO timestamp using the export timezone offset", () => {
    const msg = parseChatCsv(SAMPLE)[0];
    expect(msg.at).toBe("2026-04-16T13:15:28+07:00");
  });

  it("redacts password tokens in the text", () => {
    const csv =
      "ประเภทผู้ส่ง,ชื่อผู้ส่ง,วันส่ง,เวลาส่ง,ข้อความ\n" +
      "Account,BeeR,2026/04/16,14:00:00,รหัสผ่าน Niiza1122\n";
    expect(parseChatCsv(csv)[0].text).toBe("รหัสผ่าน [REDACTED]");
  });

  it("masks phone/account digit-runs in the text", () => {
    const csv =
      "ประเภทผู้ส่ง,ชื่อผู้ส่ง,วันส่ง,เวลาส่ง,ข้อความ\n" +
      'User,0802518587,2026/04/16,13:16:45,"ณภัทร\n0802518587\nTtb 3029057951"\n';
    const text = parseChatCsv(csv)[0].text;
    expect(text).not.toContain("0802518587");
    expect(text).not.toContain("3029057951");
    expect(text).toContain("[REDACTED_NUMBER]");
  });

  it("tolerates blank and garbage lines", () => {
    const csv =
      "ประเภทผู้ส่ง,ชื่อผู้ส่ง,วันส่ง,เวลาส่ง,ข้อความ\n" +
      "\n" +
      "garbage line without enough columns\n" +
      ",,,,\n" +
      "Bogus,someone,not-a-date,nope,hi\n" +
      "User,0802518587,2026/04/16,13:15:41,สวัสดีค่ะ\n";
    const msgs = parseChatCsv(csv);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe("สวัสดีค่ะ");
  });

  it("returns an empty array for empty input", () => {
    expect(parseChatCsv("")).toEqual([]);
  });
});

describe("maskNumbers", () => {
  it("masks a 10-digit phone number", () => {
    expect(maskNumbers("โทร 0802518587 นะคะ")).toBe("โทร [REDACTED_NUMBER] นะคะ");
  });

  it("masks dashed and spaced variants", () => {
    expect(maskNumbers("080-251-8587")).toBe("[REDACTED_NUMBER]");
    expect(maskNumbers("302 905 7951")).toBe("[REDACTED_NUMBER]");
  });

  it("leaves short numbers, dates and times untouched", () => {
    expect(maskNumbers("2026/04/16")).toBe("2026/04/16");
    expect(maskNumbers("13:15:28")).toBe("13:15:28");
    expect(maskNumbers("โอน 500 บาท")).toBe("โอน 500 บาท");
  });
});
