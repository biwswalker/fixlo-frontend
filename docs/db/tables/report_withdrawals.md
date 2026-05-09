---
title: report_withdrawals
type: table
tags: [db, table, report, import]
pk: id (integer)
aliases: [report withdrawal]
---

# `report_withdrawals`

รายการถอน import จากระบบภายนอก.

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | integer | NOT NULL | seq | PK |
| `bank_info` | text | NULL | — | เลขบัญชี plain (เช่น `0003271986`) — ⚠️ ต่างจาก [[report_deposits]].`bank_acc` ที่มี prefix `/X` |
| `full_name` | text | NULL | — | |
| `username` | text | NULL | — | |
| `amb_user` | text | NULL | — | |
| `amount` | numeric | NULL | — | |
| `status` | text | NULL | — | |
| `web_acc` | text | NULL | — | |
| `trans_date` | timestamp | NULL | — | |
| `note` | text | NULL | — | |
| `action_by` | text | NULL | — | |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |

## Constraints

- PK: `id`
- ไม่มี FK

## Sequence

- `report_withdrawals_id_seq`

## ต้อง grill

- `status` ค่าจริง: **`สำเร็จ`**, **`ยกเลิก`** (ภาษาไทย, เหมือน [[report_deposits]])
- ทำไม schema ต่างจาก [[report_deposits]] เล็กน้อย? (`bank_info` vs `bank_acc`+`promotion`+`manage_by`)
- **single-tenant (juno168 เท่านั้น)** — ไม่มี project_id field
