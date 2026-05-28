---
title: transactions
type: table
tags: [db, table, pipeline, matching, slip]
pk: id (integer)
aliases: [transaction, slip]
---

# `transactions`

สลิปที่ผ่าน AI แล้ว + matching status. ตารางหลักของระบบ.

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | integer | NOT NULL | seq | PK |
| `discord_message_id` | text | NULL | — | message ต้นทาง |
| `image_path` | text | NOT NULL | — | path ไฟล์สลิป |
| `image_hash` | text | NULL | — | ⚠️ **dead column** (1/525 rows ใน dump) — bot คำนวณ hash ใส่ filename เท่านั้น ไม่ insert ใน DB. drop ได้ |
| `source_project_id` | integer | NULL | — | FK → [[projects]] |
| `target_project_id` | integer | NULL | — | FK → [[projects]] |
| `raw_ai_output` | jsonb | NULL | — | ผลลัพธ์ดิบจาก AI |
| `amount` | numeric(15,2) | NULL | — | จำนวน final |
| `ai_amount` | numeric(15,2) | NULL | — | AI อ่านได้ |
| `qr_amount` | numeric(15,2) | NULL | — | ⚠️ **deprecated** — QR feature เลิกใช้, schedule drop |
| `is_amount_mismatch` | boolean | NULL | `false` | ⚠️ **deprecated** — QR-related, schedule drop |
| `is_amount_verified` | boolean | NULL | `false` | ⚠️ **deprecated** — QR-related, schedule drop |
| `qr_code_text` | text | NULL | — | ⚠️ **deprecated** — QR feature เลิกใช้, schedule drop |
| `ref_id` | text | NULL | — | ref ธุรกรรม |
| `is_duplicate` | boolean | NULL | `false` | |
| `sender_name` | text | NULL | — | PII |
| `sender_acc_num` | text | NULL | — | PII |
| `sender_bank` | text | NULL | — | |
| `receiver_name` | text | NULL | — | PII |
| `receiver_acc_num` | text | NULL | — | PII |
| `receiver_bank` | text | NULL | — | |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |
| `record_date` | date | NULL | — | วันที่ลงบันทึก |
| `project_account_id` | uuid | NULL | — | FK → [[project_accounts]] |
| `matching_status` | varchar | NULL | `'UNMAPPED'` | CHECK enum (ดูล่าง) |
| `matching_confidence` | numeric | NULL | — | คะแนน match |
| `possible_matches` | uuid[] | NULL | — | array candidate accounts |
| `is_time_anomaly` | boolean | NULL | `false` | เวลาสลิปผิดปกติ? |
| `transfer_date` | date | NULL | — | จากสลิป (เฉพาะ manual write — staff กรอก) |
| `transfer_time` | varchar(20) | NULL | — | จากสลิป (เฉพาะ manual write — staff กรอก) |
| `transfer_at` | timestamp | NULL | — | UTC timestamp. **worker write**: spectre worker สร้างจาก `targetDate+aiOutput.time` Bangkok → UTC. **manual write**: staff กรอกผ่าน UI (`buildTransferAt` แปลง Bangkok → UTC) |
| `match_breakdown` | jsonb | NULL | — | top-3 candidates + component scores (nameMatched, accountMatched, bankMatched) — ดู [[project_accounts]].aliases |
| `reject_reason` | text | NULL | — | เหตุผล reject (preset 5 ตัว + free text) — เฉพาะ `REJECTED` |
| `rejected_by` | text | NULL | — | username admin ที่ reject |
| `rejected_at` | timestamp | NULL | — | เวลา reject (UTC) |
| `adjusted_amount` | numeric(15,2) | NULL | — | ยอดที่ admin ปรับ (override `ai_amount` ใน outflow calc) |
| `transaction_subtype` | varchar | NULL | — | label ย่อย freetext, autocomplete จาก DISTINCT values. ดู [[transaction_types]] |

## CHECK: `chk_matching_status`

`matching_status` ∈ {`AUTO_MAPPED`, `PENDING_REVIEW`, `MANUAL_MAPPED`, `UNMAPPED`, `REJECTED`}

`REJECTED` เพิ่มใน migration 028 — migration 018 เพิ่ม reject columns แต่ลืม extend constraint (ทำให้ rejectTransaction ล้มเหลวด้วย 23514 จนกว่า 028 จะ apply)

## Constraints

- PK: `id`
- FK: `source_project_id` → [[projects]].id ON DELETE SET NULL
- FK: `target_project_id` → [[projects]].id ON DELETE SET NULL
- FK: `project_account_id` → [[project_accounts]].id

## Sequence

- `transactions_id_seq`

## Indexes

- `idx_transactions_matching_status` ON (`matching_status`)
- `idx_transactions_project_account_id` ON (`project_account_id`)
- `idx_transactions_ref_id` ON (`ref_id`)

## Domain: source vs target

⚠️ **เก็บเฉพาะ withdrawal slip** (master โอนออกไปหา player). Deposit ไม่ผ่านตรงนี้ — มาจาก scrape เว็บ ([[report_deposits]]) แทน.

- `source_project_id` = โปรเจกต์เจ้าของบัญชี master (= channel ที่ staff โพสต์)
- `target_project_id` = โปรเจกต์ผู้ยืมใช้เงินของบัญชี source
- **`source == target`** = withdrawal ของ project ตัวเอง (ไม่ยืมข้าม)
- **`source != target`** = cross-project lending — project target ยืมเงินจากบัญชี master ของ source ไปจ่าย player

`target_project_id` ถูก resolve โดย bot ผ่าน Fuse.js fuzzy search ของชื่อโปรเจกต์ใน message content.

## Match input

`runSmartMatch` ใช้ **sender** (`s_name`, `s_num`, `s_bank`) match กับ master accounts — เพราะ master เป็นคนโอนออก = อยู่ฝั่ง sender ของ slip.

## Two write paths

| | worker write (auto) | manual write (UI fallback) |
|---|---|---|
| Source | Discord bot → spectre worker | Staff form ใน UI |
| When | AI extract + match สำเร็จ | AI extract/match ไม่ได้ → staff กรอกเอง |
| Code | `fixlo-spectre/worker.js:292` | `fixlo-frontend/src/actions/dashboard.ts:645` (`saveTransactionOcrResult`) |
| Fills `record_date` | ✓ (= `target_date` ของ raw_upload = `active_date` ของ project) | ✗ |
| Fills `transfer_date` / `transfer_time` | ✗ | ✓ |

⚠️ **Date field semantics ไม่ตรงกัน 2 paths** — ทำให้ query ลำบาก. dashboard.ts:460 + reconciliation.ts:183,223 query `transfer_date` → row ที่มาจาก worker (มีแต่ `record_date`) จะไม่ติด filter. Schema debt.

**Worker ใช้ `targetDate` + `aiOutput.time` สร้าง `transfer_at`** — worker.js construct Bangkok string `${targetDate}T${time||"00:00"}:00+07:00` → UTC ISO แล้ว INSERT. ใช้ `targetDate` (จาก Discord message timestamp — reliable) แทน `aiOutput.date` เพื่อป้องกัน OCR year error (เช่น TrueMoney slip แสดง พ.ศ. 2 หลัก — AI อาจอ่าน "69" เป็น "67" → ปีผิด). fallback `aiOutput.date` ถ้าไม่มี targetDate. ถ้า AI ไม่ได้ extract `time`, fallback `00:00` Bangkok → stored as `17:00:00Z` (prev UTC day).

**Manual write ก็เก็บ UTC** — UI form input เป็น Bangkok local. `buildTransferAt(date, time)` ใน `src/lib/transferAt.ts` แปลงเป็น UTC ISO ก่อน INSERT. ทั้ง 2 paths share convention เดียวกัน.

**⚠️ Timezone query pattern** — `transfer_at` เก็บ UTC ดังนั้น query ที่ filter ตามวัน Bangkok ต้องใช้ `(transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date` ไม่ใช่ `transfer_at::date` (UTC) มิฉะนั้น slip ช่วง Bangkok 00:00–06:59 ตกวันที่ผิด. pg-node OID 1114 parser ถูก configure ใน `src/lib/db.ts` ให้ parse as UTC เพื่อป้องกัน double-conversion ใน Bangkok TZ process.

## Amount fields

- `ai_amount` — AI OCR อ่านยอดจากรูปสลิป
- `qr_amount` — decode จาก QR code บนสลิป
- `amount` — ตัวเลข **final** หลัง verify (ตรงทั้งคู่ → auto, ไม่ตรง → human review)
- `is_amount_mismatch` — `ai_amount` ≠ `qr_amount`
- `is_amount_verified` — มนุษย์ confirm แล้ว

## Matching logic

ปัจจุบัน (legacy state):
- [src/lib/accountMatcher.ts](src/lib/accountMatcher.ts) — hardcoded MASTER_ACCOUNTS 8 ตัว + Levenshtein, threshold 0.6, ใช้ใน `reconciliation.ts:293`
- [src/lib/smartMatcher.ts](src/lib/smartMatcher.ts) — DB-driven, score 0-100, threshold 85/50, ใช้ใน `dashboard.ts:632,838`

ทั้งคู่ run คู่กัน → ผลไม่ตรง = "matching เพี้ยน".

**ทิศทาง redesign**: unify เป็น single-pass fuzzy weighted (name + acc_num + bank). ดู [ADR 0001](../../adr/0001-unified-fuzzy-account-matcher.md).

## ต้อง grill ต่อ

- `possible_matches uuid[]` — เก็บกี่ candidates? เกณฑ์เลือก?
- `matching_confidence` scale 0-1 / 0-100 / %? threshold สำหรับ `AUTO_MAPPED` vs `PENDING_REVIEW`?
- `is_time_anomaly` — **ไม่มี code ใน Fixlo repo เซ็ตค่านี้** (แค่อ่านโชว์ UI ใน [src/components/dashboard/AnomaliesTable.tsx:80](src/components/dashboard/AnomaliesTable.tsx#L80) และ [src/components/dashboard/SlipReviewDialog.tsx:101](src/components/dashboard/SlipReviewDialog.tsx#L101)). น่าจะถูกเซ็ตจาก Discord bot ภายนอก หรือเป็น dead field. user จำที่มาไม่ได้ — candidate สำหรับ deprecate.
- Logic ที่ user คิดว่า "เพี้ยน" คืออะไร? อยาก redesign หรือ patch?
