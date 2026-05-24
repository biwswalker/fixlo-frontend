---
title: transaction_types
type: table
tags: [db, table, lookup, type]
pk: id
aliases: [transaction type]
---

# `transaction_types`

Lookup table label หมวดหมู่ slip — admin-managed. Phase 1 = metadata เท่านั้น (ไม่ส่งผลต่อ calculation). Phase 2 = แยก column ใน report.

ดู [ADR 0008](../../adr/0008-transaction-type-managed-table.md).

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | integer/uuid | NOT NULL | seq | PK (ต้อง confirm จาก migration) |
| `name` | varchar | NOT NULL | — | label แสดง UI |
| `description` | text | NULL | — | |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |

## Relationships

- FK เข้า: [[transactions]].`transaction_type_id` (ยังไม่ confirm — ดู ADR 0008)
- FK เข้า: [[manual_transactions]].`transaction_type_id` (ยังไม่ confirm)

## ต้อง grill

- Schema จริงจาก migration? (ADR 0008 describe แต่ยัง pending implement)
- Phase 2 calculation เปลี่ยนอะไรบ้าง?
