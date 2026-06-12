---
title: transaction_types
type: table
tags: [db, table, lookup, type]
pk: id
aliases: [transaction type]
---

# `transaction_types`

Lookup table label หมวดหมู่ slip — admin-managed (tier-1 type, ดู [[Transaction sub-type]] tier-2 freetext). Phase 1 = metadata เท่านั้น (ไม่ส่งผลต่อ calculation). Phase 2 = แยก column/calc rule.

เป็น target ของ AI classification จาก [[Slip note]] — worker map note → best managed type (ADR 0019). seeded types: `ถอนให้ลูกค้า`, `โอนไบแนน`, `รายจ่าย` (admin เพิ่มได้). `project_id = NULL` = global (ใช้ได้ทุก project).

ดู [ADR 0008](../../adr/0008-transaction-type-managed-table.md) (infra) + [ADR 0019](../../adr/0019-slip-note-classification.md) (AI classify).

## Columns (migration 026)

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | integer | NOT NULL | seq | PK |
| `project_id` | integer | NULL | — | FK → [[projects]].id ON DELETE CASCADE. NULL = global |
| `name` | text | NOT NULL | — | label แสดง UI |
| `created_by` | text | NULL | — | |
| `created_at` | timestamptz | NOT NULL | `now()` | |

## Relationships

- FK เข้า: [[transactions]].`transaction_type_id` → id ON DELETE SET NULL (migration 027)
- FK เข้า: [[manual_transactions]].`transaction_type_id` → id ON DELETE SET NULL (migration 027)
- FK ออก: `project_id` → [[projects]].id ON DELETE CASCADE

## Phase 2 (ยังไม่ทำ)

calculation rule per-type — **ต้อง grill ก่อนแตะสูตร** (ADR 0019 §6). ไม่แตะ = ไม่ต้อง grill.
