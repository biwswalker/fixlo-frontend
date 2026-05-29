---
title: daily_balances
type: table
tags: [db, table, balance, snapshot]
pk: id (integer)
aliases: [daily balance]
---

# `daily_balances`

ยอดบัญชีรายวัน. snapshot จากภาพ (มี `image_path`, `raw_ai_output`).

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | integer | NOT NULL | seq | PK |
| `date` | date | NULL | `CURRENT_DATE` | วันที่ snapshot |
| `image_path` | text | NULL | — | path ภาพ (nullable migration 025 — manual entry ไม่บังคับแนบรูป) |
| `project_id` | integer | NOT NULL | — | FK → [[projects]].id (migration 042 — replaces `project_name`) |
| `raw_ai_output` | jsonb | NULL | — | AI output |
| `balance_amount` | numeric(15,2) | NULL | — | ยอดคงเหลือ. Worker maps: `BALANCE`→`aiOutput.amount`, `GATEWAY_BALANCE`→`aiOutput.balance_amount` |
| `account_name` | text | NULL | — | ชื่อบัญชี |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |
| `discord_message_id` | text | NULL | — | |
| `platform` | text | NULL | — | platform อะไร? |
| `source` | text | NULL | `'discord'` | `'discord'` (default) \| `'manual'` (admin กรอกเอง) \| `'scraper'` (Apay gateway scraper — migration 030, constraint extended migration 037) |
| `project_account_id` | uuid | NULL | FK → [[project_accounts]].id — set by spectre matcher |
| `matching_status` | text | NOT NULL | default `'UNMATCHED'`. Values: `UNMATCHED / PENDING_REVIEW / AUTO_MAPPED / MANUAL_MAPPED / REJECTED` |
| `matched_by` | text | NULL | username ของ admin ที่ match manual |
| `match_breakdown` | jsonb | NULL | top-3 candidates + component scores (nameMatched, bankMatched) — เหมือน [[transactions]].match_breakdown |
| `reject_reason` | text | NULL | เหตุผล reject (preset หรือ free text สำหรับ "อื่นๆ") — migration 036 |
| `rejected_by` | text | NULL | username ของ admin ที่ reject — migration 036 |
| `rejected_at` | timestamptz | NULL | เวลา reject (UTC) — migration 036 |
| `last_edited_by` | text | NULL | username ที่แก้ล่าสุด — migration 035 |
| `last_edited_at` | timestamptz | NULL | เวลาแก้ล่าสุด (UTC) — migration 035 |
| `last_edited_note` | text | NULL | หมายเหตุการแก้ — migration 035 |
| `deleted_at` | timestamptz | NULL | soft delete timestamp — migration 035 |
| `deleted_by` | text | NULL | username ที่ลบ — migration 035 |
| `delete_reason` | text | NULL | เหตุผลลบ (required) — migration 035 |

## Constraints

- PK: `id`
- FK: `project_id` → [[projects]].id (NOT NULL — migration 042)
- FK: `project_account_id` → [[project_accounts]].id (nullable)
- CHECK `daily_balances_source_check`: `source IN ('discord', 'manual', 'scraper')` (migration 021, extended migration 037)

## Sequence

- `daily_balances_id_seq`

## Indexes

- `idx_daily_balances_date` ON (`date`)
- `daily_balances_scraper_date_account_unique` UNIQUE partial ON (`date`, `project_account_id`) WHERE `source = 'scraper'` — ให้ ON CONFLICT สำหรับ scraper upsert (migration 030)
- `daily_balances_account_date_unique` UNIQUE partial ON (`date`, `project_account_id`) WHERE `project_account_id IS NOT NULL` — 1 row ต่อ account ต่อวัน สำหรับ matched rows (migration 035)

## `platform`

Set โดย Gemini AI ใน worker (จาก prompt — ดู [worker.js:155](spectre/worker.js#L155)) ที่บอก AI ให้แยกตามสี logo:

ค่าจริงใน dump (10 ตัว):
- **Banks**: `SCB`, `KBANK`, `KTB`, `BBL`, `BAY`, `GSB` (prompt รองรับ `TTB`, `BAAC` ด้วย แต่ยังไม่มี data)
- **Wallets**: `TrueMoney`
- **Gateways**: `Apay`, `Wealth.wave`, `Badoo` (prompt รองรับ `DPay`, `Binance` ด้วย)

⚠️ Case ไม่ normalize (`Apay` vs `BBL` vs `TrueMoney`).

## Dedup constraint

`UNIQUE(date, discord_message_id)` — ป้องกัน staff ส่งภาพเดิมซ้ำใน Discord. เทียบเท่า `ref_id` UNIQUE ใน [[transactions]].

## ต้อง grill

- อยากบังคับ enum ของ `platform`? Worker.js prompt มี allow-list อยู่แล้ว — เพิ่ม CHECK constraint ใน DB ป้องกัน drift
- ~~ทำไมใช้ `project_name` text แทน FK?~~ — Resolved: migration 042 drop `project_name`, add `project_id integer FK`.
