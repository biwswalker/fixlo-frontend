---
title: report_manual_bonus_in
type: table
tags: [db, table, report, bonus]
pk: id (integer)
aliases: [bonus in]
---

# `report_manual_bonus_in`

โบนัสที่จ่ายเข้าให้ member.

## Columns

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer | NOT NULL | seq |
| `staff_user` | text | NULL | — |
| `amount` | numeric | NULL | — |
| `member_user` | text | NULL | — |
| `amb_user` | text | NULL | — |
| `note` | text | NULL | — |
| `trans_date` | timestamp | NULL | — |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` |

## Constraints

- PK: `id`

## Sequence

- `report_manual_bonus_in_id_seq`

## ต่างจาก credit

Bonus = โปรโมชันฟรี (เงินที่เว็บแถม) → schema **ไม่มี** `customer_bank`/`ref_time` เพราะไม่ได้มาจากสลิป (ไม่มีต้นทางจริง). Credit = เงินจริงผ่านสลิป → มี `customer_bank` + `ref_time`.

## ต้อง grill

- **in = จ่ายโบนัสให้ player** (ผิดเงื่อนไขจะเข้า `out`)
- ความสัมพันธ์กับ [[report_summary_daily]].`bonus` = sum(bonus_in - bonus_out)?
