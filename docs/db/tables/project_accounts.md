---
title: project_accounts
type: table
tags: [db, table, account, banking]
pk: id (uuid)
aliases: [project account, master account]
---

# `project_accounts`

บัญชีธนาคารของแต่ละโปรเจกต์. ใช้ match กับ slip ใน [[transactions]].

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `project_id` | varchar | NOT NULL | — | ⚠️ ไม่ FK กับ [[projects]].id (type ต่างกัน) |
| `account_name` | varchar | NOT NULL | — | ชื่อบัญชี |
| `account_number` | varchar | NULL | — | เลขบัญชี |
| `bank_code` | varchar | NOT NULL | — | รหัสธนาคาร (KBANK, SCB, …?) |
| `aliases` | text | NULL | — | ชื่ออื่นที่ใช้ match? |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |

## Constraints

- PK: `id`

## Relationships

- ไม่มี FK ออก (project_id เป็น varchar)
- FK เข้า: [[transactions]].`project_account_id`

## Indexes

- `idx_project_accounts_project_id` ON (`project_id`)

## `bank_code` (จาก dump)

Free text (ไม่ใช่ enum), รวม 4 กลุ่ม:
- ธนาคาร: `BBL`, `KBANK` (?)…
- E-wallet/PG: `TRUEMONEY`, `Apay`, `DPay`
- Crypto: `BINANCE`
- Underground gateway: `Badoo`, `Wealth.wave`, ฯลฯ

⚠️ ตัว value มี case ปนกัน (`BBL` vs `Apay` vs `Wealth.wave`) — ไม่ normalized.

## `aliases`

JSON array (text column) ของ string candidates ใช้ fuzzy match กับ `receiver_name/sender_name` ของ slip.

ตัวอย่าง:
```json
["ศุณิษา", "กรุงเทพ", "bbl"]
["อังคณา", "ทรูมันนี่", "wallet", "truemoney"]
```

## ต้อง grill

- `bank_code` อยาก normalize/enum ไหม? (BBL vs bbl, Apay vs APAY)
- algorithm match ที่ใช้ (exact / contains / fuzzy / Levenshtein)?
- `aliases` ทำไมเก็บเป็น text จริงๆ ไม่ใช่ jsonb? (parse cost)
