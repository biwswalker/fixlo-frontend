---
title: report_manual_bonus_out
type: table
tags: [db, table, report, bonus]
pk: id (integer)
aliases: [bonus out]
---

# `report_manual_bonus_out`

โบนัสที่ดึงคืน/ลบออกจาก member.

## Columns

โครงสร้างเหมือน [[report_manual_bonus_in]].

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

- `report_manual_bonus_out_id_seq`

## ต่างจาก in

**out = ดึงโบนัสคืนจาก player** (เช่น ไม่ทำตามเงื่อนไข turnover, abuse). schema เหมือน [[report_manual_bonus_in]] เพราะเป็น mirror operation.

## ต้อง grill

- ดู [[report_manual_bonus_in]]
