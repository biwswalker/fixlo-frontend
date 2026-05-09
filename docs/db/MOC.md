---
title: Database MOC
type: index
tags: [db, moc, schema]
source: spectre-090526-backup (PostgreSQL 17.9)
generated: 2026-05-09
---

# Fixlo Database — Map of Content

แผนผังโครงสร้าง DB ทั้งหมด. ดู [[CONTEXT]] สำหรับ glossary และ domain.

> Source: `spectre-090526-backup` (pg_dump v18.0, db v17.9, owner=`fixlo`).
> ⚠️ ชื่อ dump เป็น "spectre" แต่ owner เป็น `fixlo` — ต้อง grill ว่า spectre คืออะไร (codename? legacy name?).

## Cluster: Identity

- [[users]] — ⚠️ **deprecated** (auth ย้ายไป external API)

## Cluster: Project & accounts

- [[projects]] — โปรเจกต์หลัก (int PK)
- [[project_accounts]] — บัญชีธนาคารของโปรเจกต์ (uuid PK)

## Cluster: Slip pipeline (Discord + AI)

ภาพสลิป → AI extract → match กับ project_account.

- [[raw_uploads]] — ภาพที่อัปโหลดเข้ามา, ai_status
- [[transactions]] — ผลลัพธ์หลัง AI ประมวล + matching
- [[daily_balances]] — snapshot ยอดบัญชีรายวัน

## Cluster: Manual adjustments

- [[manual_adjustments]] — ปรับยอดด้วยมือ

## Cluster: External reports (CSV import?)

ตารางกลุ่มนี้ schema คล้าย CSV import จากระบบภายนอก. field generic (`amb_user, web_acc, staff_user`).

- [[report_deposits]] — รายการฝาก
- [[report_withdrawals]] — รายการถอน
- [[report_manual_bonus_in]] / [[report_manual_bonus_out]] — โบนัสเข้า/ออก
- [[report_manual_credit_in]] / [[report_manual_credit_out]] — เครดิตเข้า/ออก
- [[report_summary_daily]] — สรุปยอดรายวันต่อโปรเจกต์

## Enums

- `user_role` = `ADMIN | SUPPORT | VIEWER` (ดู [[users]])
- `transactions.matching_status` (CHECK constraint) = `AUTO_MAPPED | PENDING_REVIEW | MANUAL_MAPPED | UNMAPPED`

## Schema observations (ต้อง grill)

1. **PK ปนกัน**: บางตารางใช้ `integer` (legacy) บางตารางใช้ `uuid` (`gen_random_uuid()`). กลุ่ม uuid: users, project_accounts, manual_adjustments. กลุ่ม int: projects, raw_uploads, transactions, daily_balances, report_*.
2. **`project_id` type ไม่ตรงกัน**: [[projects]].`id` = `integer` แต่ [[project_accounts]].`project_id`, [[manual_adjustments]].`project_id`, [[report_summary_daily]].`project_id` = `varchar` — **ไม่มี FK declared**. เป็น project_name หรือ project code?
3. **report_summary_daily.project_id DEFAULT `'juno168'`** — เคย single-tenant?
4. **transactions.transfer_date + transfer_time** แยกเป็น date + varchar(20) แทน timestamp.
5. **daily_balances** ใช้ `project_name text` ไม่ใช่ project_id.
6. FK ส่วนใหญ่ `ON DELETE SET NULL` — ลบ project แล้วไม่ลบ history.
