---
title: System Overview
type: guide
tags: [system, overview]
---

# Fixlo ทำอะไร — ภาพรวม

> Fixlo = ระบบ **กระทบยอด (reconciliation)** ของ casino online. ตรวจว่าเงินที่เว็บเกมรายงาน = เงินจริงในบัญชีธนาคาร master หรือไม่.

## ปัญหาที่แก้

เว็บเกม (juno168) มี:
- **ยอดฝาก (deposit)** — player โอนเข้าบัญชี master ของ project. รายงานจาก scraper
- **ยอดถอน (withdraw)** — operator (staff) โอนออกจากบัญชี master ไปให้ player. มีสลิปเป็นหลักฐาน
- **ยอดคงเหลือธนาคาร** — snapshot รายวัน

ต้องเช็คว่า: `ยอดเริ่ม + รับเข้า - จ่ายออก = ยอดสิ้นวัน` ตรงไหม. ถ้าไม่ตรง → มี variance ต้องสืบ.

## แหล่งข้อมูล (data sources)

ระบบ frontend อ่านจาก **3 source หลัก**:

| Source | ตารางใน DB | ใครเขียน | ความหมาย |
|---|---|---|---|
| **Web scraper** (Python) | [[../db/tables/report_deposits\|report_deposits]], [[../db/tables/report_withdrawals\|report_withdrawals]], [[../db/tables/report_summary_daily\|report_summary_daily]] | scraper repo (ที่ 3) ดึงจาก `app.juno168.app/upsx` cron daily | รายการที่เว็บเกมรายงาน + summary รายวันต่อ project |
| **Slip pipeline** (Discord + AI) | [[../db/tables/transactions\|transactions]], [[../db/tables/raw_uploads\|raw_uploads]], [[../db/tables/daily_balances\|daily_balances]] | bot + worker จาก [fixlo-spectre](https://github.com/biwswalker/fixlo-spectre) | สลิปจริงที่ staff โอนออก + ยอด balance ที่อ่านจาก mobile banking app |
| **Manual ops** | [[../db/tables/manual_adjustments\|manual_adjustments]] | admin/owner ปรับใน UI | แก้ส่วนต่างที่ reconcile ไม่ตรง |

## Flow โดยรวม

```
                 ┌──────────────────────────────────┐
                 │  เว็บเกม juno168 (external)        │
                 └────┬─────────────────────────────┘
                      │ scrape daily
                      ▼
       report_deposits, report_withdrawals, report_summary_daily
                      │
                      │
   Discord ──slip──►  raw_uploads ──AI──► transactions  (สลิปการโอนออก)
                      │
                      │ snapshot mobile banking
                      ▼
                daily_balances (ยอดสิ้นวันจริงในธนาคาร)
                      │
                      ▼
             ┌────────────────────────┐
             │  Fixlo Frontend        │
             │  - หน้าปัดหลัก          │
             │  - หน้ากระทบยอด        │
             └────────────────────────┘
                      │
                      ▼
              admin ปรับ manual_adjustments
              ถ้า variance ≠ 0
```

## หลักการสำคัญที่ส่งผลต่อตัวเลข

1. **ยอดฝาก (deposit) มาจาก scraper เท่านั้น** — ไม่ผ่าน slip pipeline. ใช้ [[../db/tables/report_deposits|report_deposits]] กรอง `status = 'สำเร็จ'`
2. **ยอดถอน (withdraw) มี 2 แหล่ง**:
   - **Scraper** ([[../db/tables/report_withdrawals|report_withdrawals]] / [[../db/tables/report_summary_daily|report_summary_daily]].`withdraw`) = ที่เว็บเกมรายงาน
   - **Slip pipeline** ([[../db/tables/transactions|transactions]]) = สลิปจริงที่ AI อ่าน → ใช้ในหน้ากระทบยอด (ฝั่ง expected outflow)
3. **`manual_adjustments` = ปรับ master account** (ฝั่ง Fixlo). signed (`+` เพิ่ม, `-` หัก). ใช้แก้ส่วนต่างเฉพาะหน้ากระทบยอด
4. **`report_manual_*` = ปรับ player** (เครดิต/โบนัส). คนละเรื่องกับ `manual_adjustments`. โผล่ที่ breakdown ใน [[../db/tables/report_summary_daily|report_summary_daily]] (`manual_in`, `manual_out`, `bonus`, etc.)
5. **`status = 'สำเร็จ'`** = string ไทย hardcoded. Filter รายการที่สำเร็จเท่านั้นออกจาก deposits/withdrawals

## สิทธิ์ (RBAC)

จาก [[../../CONTEXT|CONTEXT]] glossary:
- `owner` — เห็นทุกอย่าง + manage admins/billing
- `admin` — เห็นทุกอย่าง + เพิ่ม manual_adjustments
- `staff` — เห็นหน้าปัดหลัก, approve transactions
- `viewer` — read-only หน้าปัดหลัก

หน้ากระทบยอด: เฉพาะ `owner` + `admin`. role อื่นโดน redirect ไป `/dashboard/all`.

ปุ่ม "เพิ่มรายการปรับปรุง" ([[../db/tables/manual_adjustments|manual_adjustments]]): เฉพาะ `admin`.
