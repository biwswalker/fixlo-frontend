// Parse a LINE OA chat-history CSV export into typed, scrubbed message records.
// This is the source seam for KB mining (PRD #177 / slice M1 #178): every later
// mining step reads ChatMessage[], never the raw CSV.
//
// LINE OA export shape:
//   BOM, then metadata rows  (ชื่อบัญชี, ไทม์โซน, วันดาวน์โหลด)
//   then a column header row (ประเภทผู้ส่ง,ชื่อผู้ส่ง,วันส่ง,เวลาส่ง,ข้อความ)
//   then data rows           (senderType, senderName, date, time, text)
// The text column is RFC-4180 quoted and may span multiple physical lines.
//
// Scrub at the source (ADR 0004): passwords and phone/account digit-runs are
// masked here so nothing downstream — print, artifact, or DB write — can leak.

import { redactPasswords } from "./crmPasswordRedact";

export type SenderType = "customer" | "admin" | "bot";

export interface ChatMessage {
  senderType: SenderType;
  senderName: string;
  at: string; // ISO 8601, e.g. "2026-04-16T13:15:28+07:00"
  text: string;
}

/** LINE OA name used for the channel's automatic greeting/auto-reply. */
const AUTO_REPLY_NAME = "ข้อความตอบกลับอัตโนมัติ";

const META_LABELS = new Set(["ชื่อบัญชี", "ไทม์โซน", "วันดาวน์โหลด"]);
const TIMEZONE_LABEL = "ไทม์โซน";
const HEADER_FIRST_COL = "ประเภทผู้ส่ง";
const DEFAULT_OFFSET = "+07:00";

const NUMBER_PLACEHOLDER = "[REDACTED_NUMBER]";
// A phone/bank-account-like run: digits optionally broken by single spaces or
// dashes (080-251-8587, 302 905 7951), masked when it holds 9+ digits. Times
// (13:15:28) use colons and dates (2026/04/16) use slashes, so both are spared.
const DIGIT_RUN = /\d(?:[ -]?\d){8,}/g;

/**
 * Mask phone/bank-account-like digit runs (9+ digits, tolerant of space/dash
 * separators) to a placeholder. Content-length numbers like years or short IDs
 * are left intact.
 */
export function maskNumbers(text: string): string {
  if (!text) return text;
  return text.replace(DIGIT_RUN, NUMBER_PLACEHOLDER);
}

/** Run a message body through password redaction then number masking. */
function scrub(text: string): string {
  return maskNumbers(redactPasswords(text));
}

/**
 * Split CSV text into rows of fields per RFC 4180: double-quoted fields may
 * contain commas, newlines, and escaped quotes (""). Handles \n and \r\n.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let sawContent = false; // any field content or delimiter seen on this row

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    sawContent = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      sawContent = true;
    } else if (c === ",") {
      endField();
      sawContent = true;
    } else if (c === "\r") {
      // swallow; the \n handles the row break
    } else if (c === "\n") {
      if (sawContent || field.length > 0 || row.length > 0) endRow();
    } else {
      field += c;
      sawContent = true;
    }
  }
  // trailing row without a final newline
  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

/** Normalize the ไทม์โซน metadata value (e.g. "'+07:00") to an ISO offset. */
function normalizeOffset(raw: string): string {
  const m = raw.match(/[+-]\d{2}:?\d{2}/);
  if (!m) return DEFAULT_OFFSET;
  const v = m[0];
  return v.includes(":") ? v : `${v.slice(0, 3)}:${v.slice(3)}`;
}

/** Combine LINE OA date (YYYY/MM/DD) + time (HH:MM:SS) + offset into ISO 8601. */
function toIso(date: string, time: string, offset: string): string {
  return `${date.replace(/\//g, "-")}T${time}${offset}`;
}

function mapSender(senderType: string, senderName: string): SenderType | null {
  if (senderType === "User") return "customer";
  if (senderType === "Account") {
    return senderName === AUTO_REPLY_NAME ? "bot" : "admin";
  }
  return null;
}

/**
 * Parse a LINE OA chat-history CSV into scrubbed, typed ChatMessage records.
 * Metadata and column-header rows are skipped; malformed/blank/garbage lines
 * are tolerated (silently dropped). Each message's text is redacted for
 * passwords and phone/account numbers before it leaves the parser.
 */
export function parseChatCsv(csvText: string): ChatMessage[] {
  if (!csvText) return [];
  // Strip a leading UTF-8 BOM if present.
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;

  const rows = parseCsvRows(text);
  let offset = DEFAULT_OFFSET;
  const messages: ChatMessage[] = [];

  for (const cols of rows) {
    const first = (cols[0] ?? "").trim();
    if (cols.every((c) => !c.trim())) continue; // blank line

    if (META_LABELS.has(first)) {
      if (first === TIMEZONE_LABEL && cols[1]) offset = normalizeOffset(cols[1]);
      continue;
    }
    if (first === HEADER_FIRST_COL) continue; // column header

    if (cols.length < 5) continue; // garbage / truncated row
    const [senderType, senderName, date, time] = cols;
    const senderMapped = mapSender(senderType.trim(), senderName);
    if (!senderMapped) continue;
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date.trim())) continue;
    if (!/^\d{1,2}:\d{2}:\d{2}$/.test(time.trim())) continue;

    // The message body is the 5th column; a stray comma in an unquoted export
    // would split it further, so re-join any overflow columns.
    const rawText = cols.slice(4).join(",");
    messages.push({
      senderType: senderMapped,
      senderName,
      at: toIso(date.trim(), time.trim(), offset),
      text: scrub(rawText),
    });
  }

  return messages;
}
