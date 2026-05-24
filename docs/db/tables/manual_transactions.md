---
title: manual_transactions
type: table
tags: [db, table, manual, slip]
pk: id (uuid)
aliases: [manual transaction, manual slip]
---

# `manual_transactions`

Slip โอนเงินที่ admin กรอกเองผ่าน UI — ไม่ผ่าน Discord bot. `matching_status = MANUAL_MAPPED` ทันทีที่สร้าง (admin เลือก account โดยตรง).

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `project_account_id` | uuid | NOT NULL | — | FK → [[project_accounts]].id |
| `amount` | numeric(15,2) | NOT NULL | — | จำนวนเงิน |
| `transfer_at` | timestamp | NOT NULL | — | เวลาโอน (UTC) — admin ระบุ |
| `image_path` | text | NULL | — | path slip (optional — upload ผ่าน `/api/upload` → `/app/data/manual/<uuid>.jpg`) |
| `note` | text | NULL | — | หมายเหตุ |
| `created_by` | text | NULL | — | username admin |
| `matching_status` | varchar | NOT NULL | `'MANUAL_MAPPED'` | fixed = `MANUAL_MAPPED` |
| `transaction_subtype` | varchar | NULL | — | label ย่อย freetext (เหมือน [[transactions]].`transaction_subtype`) |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |

## Constraints

- PK: `id`
- FK: `project_account_id` → [[project_accounts]].id

## Domain

รวมกับ [[transactions]] ใน reconciliation outflow:

```
effectiveOutflow = Σ COALESCE(adjusted_amount, ai_amount) [transactions]
                + Σ amount [manual_transactions]
```

ไม่มี Smart Matching step — admin เลือก account ตอนสร้าง.

## ต้อง grill

- `id` เป็น uuid จริงไหม หรือ integer? (ต้อง confirm จาก migration)
- มี `transaction_type_id` FK → [[transaction_types]] ไหม?
