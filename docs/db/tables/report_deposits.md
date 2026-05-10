---
title: report_deposits
type: table
tags: [db, table, report, import]
pk: id (integer)
aliases: [report deposit]
---

# `report_deposits`

รายการฝาก import จากระบบภายนอก. schema generic (csv-shaped).

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | integer | NOT NULL | seq | PK |
| `bank_acc` | text | NULL | — | เลขบัญชีลูกค้า (sender). format ผสม: `/X<10 digits>` หรือ plain 10 digits. user ไม่ทราบที่มา `/X` — ปะปนแม้ใน wallet เดียวกัน. น่าจะ scrape artifact จาก HTML markup ที่ฝั่งเว็บใส่ marker บางอย่าง |
| `full_name` | text | NULL | — | ชื่อเต็ม |
| `username` | text | NULL | — | member username (ผู้เล่น) |
| `amb_user` | text | NULL | — | ambassador code |
| `amount` | numeric | NULL | — | |
| `promotion` | text | NULL | — | ชื่อโปรโมชัน text (เช่น "โปรฝากแรก 200 รับ 200", "-" = ไม่มี) |
| `status` | text | NULL | — | `สำเร็จ` / `ยกเลิก` |
| `web_acc` | text | NULL | — | บัญชีฝั่งเว็บเกมที่รับเงิน (master account ฝั่งเว็บ) — format: `<phone> \| <wallet>` หรือ project name |
| `manage_by` | text | NULL | — | ⚠️ data จริงเป็น `-` ทั้งหมด — dead/unused field |
| `trans_date` | timestamp | NULL | — | วันที่ทำรายการ |
| `action_by` | text | NULL | — | staff ที่ approve. `AUTO` = bot, `<name>add` = พนักงานคน X |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |

## Constraints

- PK: `id`
- ไม่มี FK

## Sequence

- `report_deposits_id_seq`

## ต้อง grill

- import จากที่ไหน? (CSV upload? webhook? scrape?)
- `amb_user` = **ambassador code** ⚠️ format ไม่ stable (อย่า parse prefix เพื่อ infer project — ดู [[CONTEXT]])
- `status` ค่าจริง: **`สำเร็จ`**, **`ยกเลิก`** (ภาษาไทย)
- `promotion` = ชื่อ promotion text (เช่น "โปรฝากแรก 200 รับ 200", "รับโบนัส 10% ทุกบิลฝาก")
- ตารางนี้ **ยังเป็น single-tenant (juno168 เท่านั้น)** — ไม่มี project_id field. ถ้า expand multi-tenant ต้อง add column.
