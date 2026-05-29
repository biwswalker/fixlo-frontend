---
title: projects
type: table
tags: [db, table, project]
pk: id (integer)
aliases: [project]
---

# `projects`

โปรเจกต์หลัก. ผูกกับ Discord channel.

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | integer | NOT NULL | seq | PK — canonical FK key cross-table |
| `project_name` | text | NOT NULL | — | UNIQUE — display label (mutable) |
| `code` | text | NOT NULL | — | UNIQUE — URL slug + natural key (immutable). See [ADR 0013](../../adr/0013-project-canonical-identifier.md) |
| `aliases` | text[] | NOT NULL | `{}` | short forms ที่ staff พิมพ์ `#<alias>` ใน Discord (cross-project lending) |
| `discord_channel_id` | text | NULL | — | ผูก channel (NOT NULL เมื่อ ACTIVE via CHECK) |
| `status` | text | NULL | `'ACTIVE'` | values: `ACTIVE`, `INACTIVE` |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |
| `active_date` | date | NULL | — | scrape anchor (NOT NULL เมื่อ ACTIVE via CHECK) |

## Constraints

- PK: `id`
- UNIQUE: `project_name`, `code`, `discord_channel_id` (partial WHERE NOT NULL)
- CHECK: `status != 'ACTIVE' OR (discord_channel_id IS NOT NULL AND active_date IS NOT NULL)`

## Sequence

- `projects_id_seq` (integer, START 1)

## Relationships

FK เข้า:
- [[raw_uploads]].`source_project_id` (ON DELETE SET NULL)
- [[raw_uploads]].`target_project_id` (ON DELETE SET NULL)
- [[transactions]].`source_project_id` (ON DELETE SET NULL)
- [[transactions]].`target_project_id` (ON DELETE SET NULL)

✅ **Resolved** (migrations 040–042, [ADR 0013](../../adr/0013-project-canonical-identifier.md)) — ทุก reference เป็น `project_id integer FK` แล้ว:
- [[project_accounts]].`project_id` integer FK ✓
- [[manual_adjustments]].`project_id` integer FK ✓
- [[report_summary_daily]].`project_id` integer FK ✓
- [[daily_balances]] `project_name` dropped, `project_id integer FK` ✓
- `report_deposits`, `report_withdrawals`, `report_manual_credit_*`, `report_manual_bonus_*` — `project_id integer NOT NULL DEFAULT 1` + FK ✓ (scraper rewrite จะ populate per-project ภายหลัง)

## Indexes

ไม่มี (PK + UNIQUE)

## Resolved (see [ADR 0013](../../adr/0013-project-canonical-identifier.md))

- `status` enum = `ACTIVE` | `INACTIVE` enforced via CHECK + ACTIVE invariant
- `active_date` = scrape anchor (NOT explained as create date)
- `project_id` varchar history = ad-hoc dev. Plan: integer FK ทุกที่
