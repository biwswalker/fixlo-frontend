---
title: report_apay_daily
type: table
tags: [db, table, gateway, apay, reconciliation]
pk: id (integer)
aliases: [apay daily, gateway daily]
---

# `report_apay_daily`

Daily aggregate ยอดฝาก/ถอนจาก Apay gateway portal. Scraper ดึงข้อมูล 23:59 ทุกวัน.

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | integer | NOT NULL | seq | PK |
| `date` | date | NOT NULL | — | วันที่ของข้อมูล |
| `project_account_id` | uuid | NOT NULL | — | FK → [[project_accounts]].id |
| `deposit_amount` | numeric(15,2) | NULL | — | ยอดฝากรวมของวัน — "Deposit" ใน Payment Summary card |
| `withdrawal_amount` | numeric(15,2) | NULL | — | ยอดถอนรวมของวัน — "Withdrawal" ใน Payment Summary card |
| `fee_amount` | numeric(15,2) | NULL | — | ค่าธรรมเนียม — "Fee" ใน Payment Summary card (migration 031) |
| `scraped_at` | timestamp | NULL | — | เวลาที่ scraper ดึงข้อมูลสำเร็จ |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |

## Constraints

- PK: `id`
- FK: `project_account_id` → [[project_accounts]].id
- UNIQUE: `(date, project_account_id)` → ON CONFLICT DO UPDATE (overwrite ด้วยค่าล่าสุด)

## Usage

- **cross-check layer** ใน reconciliation page: โชว์ Apay-reported figures ข้างๆ account breakdown
- ไม่เข้าสูตร ยอดเข้าระบบ(สลิป) โดยตรง — ใช้เปรียบเทียบกับ ยอดรับ ที่คำนวณจาก `daily_balances`
- `deposit_amount` ≈ ยอดรับ ของ Apay account — ถ้าต่างกันมาก = signal ผิดปกติ
- `balance_amount` ใน `daily_balances` = `Deposit Wallet + Withdrawal Wallet` (สองกระเป๋าแยก ไม่ใช่ Deposit/Withdrawal transaction)
- `fee_amount` เก็บไว้ phase 2 — ยังไม่เข้าสูตร reconciliation

## ต้อง grill

- เมื่อ multi-tenant active: เพิ่ม project-scope ด้วย `project_account_id` FK ครอบอยู่แล้ว ไม่ต้องเพิ่ม column
