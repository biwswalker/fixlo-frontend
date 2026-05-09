---
title: manual_adjustments
type: table
tags: [db, table, adjustment, manual]
pk: id (uuid)
aliases: [manual adjustment]
---

# `manual_adjustments`

ปรับยอดด้วยมือ. มี audit trail (`created_by`, `reason`).

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `project_id` | varchar | NOT NULL | — | ⚠️ ไม่ FK |
| `master_account` | varchar | NOT NULL | — | บัญชีหลัก? |
| `amount` | numeric | NOT NULL | — | จำนวน (+/-?) |
| `reason` | text | NOT NULL | — | เหตุผล |
| `adjustment_date` | date | NOT NULL | — | วันที่ปรับ |
| `created_by` | uuid | NULL | — | → [[users]].id (ไม่ declared FK) |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |

## Constraints

- PK: `id`
- ไม่มี FK declared

## Domain

- `master_account` = [[project_accounts]].`id` (uuid string) — **ควรทำ FK** แต่ตอนนี้ยังไม่ได้ declare. Schema debt.
- `project_id` = project code (varchar, ไม่ FK กับ [[projects]].id) — ดู schema debt ใน [[CONTEXT]]

## Convention (proposed)

**`amount` = signed numeric**: `+` = เพิ่มยอด master, `-` = หักยอด master. SUM(amount) = ผลรวมการปรับสุทธิ. `reason` text บอก context (เช่น "ค่าธรรมเนียม", "เงินคืน", "ปรับยอดให้ตรง scrape").

ทางเลือกที่ตัดทิ้ง: เพิ่ม `direction` enum (DEBIT/CREDIT) — แยก concern แต่เพิ่ม column ที่ derive จาก sign ได้.

## ต้อง grill ต่อ

- ทำไม `created_by` ไม่ทำ FK กับ [[users]]? — เพราะ users deprecated → uuid ใน `created_by` ก็ไม่ได้มาจาก users table จริงแล้ว. ต้อง backfill จาก external API user id?
- adjustment_date vs created_at — lag ปกติเท่าไหร่? (back-dated entry?)
