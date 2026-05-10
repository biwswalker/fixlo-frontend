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
| `image_path` | text | NOT NULL | — | path ภาพ |
| `project_name` | text | NULL | — | ⚠️ ใช้ name ไม่ใช่ id |
| `raw_ai_output` | jsonb | NULL | — | AI output |
| `balance_amount` | numeric(15,2) | NULL | — | ยอดคงเหลือ |
| `account_name` | text | NULL | — | ชื่อบัญชี |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |
| `discord_message_id` | text | NULL | — | |
| `platform` | text | NULL | — | platform อะไร? |

## New columns (migration pending)

| Column | Type | Null | Note |
|---|---|---|---|
| `project_account_id` | uuid | NULL | FK → `project_accounts.id` — set by spectre matcher |
| `matching_status` | text | NOT NULL default `'UNMATCHED'` | `UNMATCHED / PENDING_REVIEW / AUTO_MAPPED / MANUAL_MAPPED` |
| `matched_by` | text | NULL | username ของ admin ที่ match manual |
| `match_breakdown` | jsonb | NULL | top-3 candidates + component scores (nameMatched, bankMatched) — เหมือน [[transactions]].match_breakdown |

## Constraints

- PK: `id`
- FK: `project_account_id` → `project_accounts.id` (nullable)

## Sequence

- `daily_balances_id_seq`

## Indexes

- `idx_daily_balances_date` ON (`date`)

## `platform`

Set โดย Gemini AI ใน worker (จาก prompt — ดู [worker.js:155](spectre/worker.js#L155)) ที่บอก AI ให้แยกตามสี logo:

ค่าจริงใน dump (10 ตัว):
- **Banks**: `SCB`, `KBANK`, `KTB`, `BBL`, `BAY`, `GSB` (prompt รองรับ `TTB`, `BAAC` ด้วย แต่ยังไม่มี data)
- **Wallets**: `TrueMoney`
- **Gateways**: `Apay`, `Wealth.wave`, `Badoo` (prompt รองรับ `DPay`, `Binance` ด้วย)

⚠️ Case ไม่ normalize (`Apay` vs `BBL` vs `TrueMoney`).

## Dedup constraint (migration pending)

`UNIQUE(date, discord_message_id)` — ป้องกัน staff ส่งภาพเดิมซ้ำใน Discord. เทียบเท่า `ref_id` UNIQUE ใน [[transactions]].

## ต้อง grill

- อยากบังคับ enum ของ `platform`? Worker.js prompt มี allow-list อยู่แล้ว — เพิ่ม CHECK constraint ใน DB ป้องกัน drift
- ทำไมใช้ `project_name` text แทน FK? legacy data
