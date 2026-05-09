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
| `id` | integer | NOT NULL | seq | PK |
| `project_name` | text | NOT NULL | — | UNIQUE |
| `discord_channel_id` | text | NULL | — | ผูก channel |
| `status` | text | NULL | `'ACTIVE'` | ไม่มี CHECK — ค่าจริงมีอะไรบ้าง? |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |
| `active_date` | date | NULL | — | วันเริ่ม active? |

## Constraints

- PK: `id`
- UNIQUE: `project_name`

## Sequence

- `projects_id_seq` (integer, START 1)

## Relationships

FK เข้า:
- [[raw_uploads]].`source_project_id` (ON DELETE SET NULL)
- [[raw_uploads]].`target_project_id` (ON DELETE SET NULL)
- [[transactions]].`source_project_id` (ON DELETE SET NULL)
- [[transactions]].`target_project_id` (ON DELETE SET NULL)

⚠️ ตารางอื่นใช้ `project_id varchar` → ไม่ FK กับ `projects.id`:
- [[project_accounts]].`project_id`
- [[manual_adjustments]].`project_id`
- [[report_summary_daily]].`project_id`

## Indexes

ไม่มี (PK + UNIQUE)

## ต้อง grill

- `status` ค่าจริงใน dump: **`ACTIVE`**, **`INACTIVE`** — มีค่าอื่น? อยากเป็น CHECK enum?
- `active_date` = วันที่ใช้เป็น **anchor** ใน scraping job (ดึงข้อมูลจาก external API ตั้งแต่วันนี้เป็นต้นไป — ไม่ได้แปลว่าวันสร้าง)
- ทำไม project_id ตารางอื่นเป็น varchar? เคยเป็น project_name string?
