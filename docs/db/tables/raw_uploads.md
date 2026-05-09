---
title: raw_uploads
type: table
tags: [db, table, pipeline, ai, discord]
pk: id (integer)
aliases: [raw upload, upload]
---

# `raw_uploads`

ภาพสลิปที่อัปโหลดผ่าน Discord. รอ AI ประมวล. ขั้นแรกของ pipeline → [[transactions]].

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | integer | NOT NULL | seq | PK |
| `source_project_id` | integer | NULL | — | FK → [[projects]] |
| `discord_user_id` | text | NULL | — | ผู้ส่ง |
| `image_path` | text | NOT NULL | — | path ไฟล์ |
| `ai_status` | text | NULL | `'PENDING'` | ไม่มี CHECK — ค่าอื่นๆ? |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |
| `discord_message_id` | text | NULL | — | message ต้นทาง |
| `target_date` | date | NULL | — | วันที่อ้างอิง? |
| `target_project_id` | integer | NULL | — | FK → [[projects]] |

## Constraints

- PK: `id`
- FK: `source_project_id` → [[projects]].id ON DELETE SET NULL
- FK: `target_project_id` → [[projects]].id ON DELETE SET NULL

## Sequence

- `raw_uploads_id_seq`

## Indexes

- `idx_raw_uploads_status` ON (`ai_status`)

## บทบาทใน pipeline

Audit log ของภาพที่ Discord bot ดักได้. ดู bot.js / worker.js ใน https://github.com/biwswalker/fixlo-spectre.

Flow:
1. Bot listens บน channels ที่ `projects.status='ACTIVE'` + `discord_channel_id != null`
2. มี attachment image → save disk → INSERT raw_uploads (`ai_status='PENDING'`)
3. `target_project_id` = Fuse.js fuzzy search ของ message content (สำหรับ cross-project lending)
4. Staff พิมพ์ trigger ("สลิปการโอนออก..." หรือ "รันคิว") → enqueue PENDING uploads ของ project นั้น
5. Worker process → INSERT [[transactions]] หรือ [[daily_balances]] ตาม `aiOutput.type` → UPDATE ai_status

raw_uploads ไม่ถูกลบ ไม่ link กลับ.

## ต้อง grill

- `ai_status` มี **3 ค่าจริง**: `PENDING` (default ตอน insert), `PROCESSED` (worker สำเร็จ), `ERROR` (worker fail — ดู [worker.js:342](spectre/worker.js#L342)). dump 17 พ.ค. ไม่มี ERROR เพราะอาจไม่มี job fail. **Plan: CHECK constraint enum 3 ค่า**
- ไม่มี FK กับ transactions/daily_balances **โดยตั้งใจ** — raw_uploads เป็น **audit log**, status ปรับตอน process. ไม่ link กลับ.
- bot repo: https://github.com/biwswalker/fixlo-spectre (repo แยก, ต่าง codebase)
- source vs target project — กรณีไหนใช้ทั้งคู่?
