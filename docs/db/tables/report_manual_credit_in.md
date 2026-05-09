---
title: report_manual_credit_in
type: table
tags: [db, table, report, credit]
pk: id (integer)
aliases: [credit in]
---

# `report_manual_credit_in`

เครดิตที่เพิ่มให้ member ด้วยมือ. มี `customer_bank` + `ref_time` (ต่างจาก bonus).

## Columns

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer | NOT NULL | seq |
| `staff_user` | text | NULL | — |
| `amount` | numeric | NULL | — |
| `member_user` | text | NULL | — |
| `customer_bank` | text | NULL | — | ธนาคารลูกค้า (ชื่อไทย: 'ทรูวอลเลต', 'ธนาคารกรุงเทพ') |
| `amb_user` | text | NULL | — | ambassador code |
| `ref_time` | text | NULL | — | เวลา**จริง**ของรายการ (จากสลิป) format `'YYYY-MM-DD HH:MM'`. ค่า `'1970-01-01 07:00'` = ไม่มี/missing |
| `note` | text | NULL | — | |
| `trans_date` | timestamp | NULL | — | เวลา record ลงระบบ (ไม่ใช่เวลารายการจริง) |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` |

## Constraints

- PK: `id`

## Sequence

- `report_manual_credit_in_id_seq`

## ต้อง grill ต่อ

- ทำไม `ref_time` ใช้ text ไม่ใช่ timestamp? (legacy / scrape format)
- `out` ([[report_manual_credit_out]]) ทำไมไม่มี ref_time? = รายการ "out" ไม่ได้มาจากสลิป?
