---
title: users
type: table
tags: [db, table, identity, deprecated, legacy]
pk: id (uuid)
aliases: [user]
status: deprecated
---

# `users` (DEPRECATED)

⚠️ **ตารางนี้เลิกใช้แล้ว.** Auth ปัจจุบันมาจาก external API ([src/auth.ts:46](src/auth.ts#L46)) — Postgres `users` ไม่ถูก reference ใน auth flow.

Roles ใน external API ใช้ lowercase (`owner | admin | staff | viewer`) ขณะที่ enum `user_role` ใน DB ใช้ uppercase (`ADMIN | SUPPORT | VIEWER`) — สอง role system แยกขาดจากกัน.

**Plan: drop ตารางนี้** (รอ confirm ว่าไม่มี FK เหลือ — `manual_adjustments.created_by` ไม่ FK declared).

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `username` | varchar(255) | NOT NULL | — | UNIQUE |
| `password_hash` | text | NOT NULL | — | hashed |
| `role` | `user_role` enum | NULL | `'VIEWER'` | ดู Enum ด้านล่าง |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |

## Enum: `user_role`

- `ADMIN`
- `SUPPORT`
- `VIEWER`

## Constraints

- PK: `id`
- UNIQUE: `username`

## Relationships

- ไม่มี FK ออก
- FK เข้า: `manual_adjustments.created_by` (uuid) — **ไม่ declared FK** แต่ type ตรง

## Indexes

ไม่มี (PK + UNIQUE สร้าง index implicit)

## ต้อง grill

- `created_by` ของ [[manual_adjustments]] ทำไมไม่ทำ FK?
- เก็บ session/token ที่ไหน? ไม่มีตาราง sessions
