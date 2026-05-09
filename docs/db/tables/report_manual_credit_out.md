---
title: report_manual_credit_out
type: table
tags: [db, table, report, credit]
pk: id (integer)
aliases: [credit out]
---

# `report_manual_credit_out`

เครดิตที่หักออกจาก member ด้วยมือ.

## Columns

ต่างจาก [[report_manual_credit_in]] ตรงไม่มี `ref_time`.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer | NOT NULL | seq |
| `staff_user` | text | NULL | — |
| `amount` | numeric | NULL | — |
| `member_user` | text | NULL | — |
| `customer_bank` | text | NULL | — |
| `amb_user` | text | NULL | — |
| `note` | text | NULL | — |
| `trans_date` | timestamp | NULL | — |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` |

## Constraints

- PK: `id`

## Sequence

- `report_manual_credit_out_id_seq`

## ต้อง grill

- ดู [[report_manual_credit_in]]
- ทำไม out ไม่มี `ref_time`? user ไม่ทราบ — อาจเป็น schema oversight หรือ out ไม่ได้มาจากสลิป (debit เกิดจาก staff hand-off)
