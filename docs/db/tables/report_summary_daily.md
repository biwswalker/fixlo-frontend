---
title: report_summary_daily
type: table
tags: [db, table, report, summary]
pk: id (integer)
aliases: [daily summary]
---

# `report_summary_daily`

สรุปยอดรายวันต่อโปรเจกต์. รวมทุก money flow.

## Columns

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `id` | integer | NOT NULL | seq | PK |
| `report_date` | date | NULL | — | วันสรุป |
| `deposit` | numeric | NULL | — | ฝากปกติ — **เงินเข้า** |
| `manual_in` | numeric | NULL | — | manual credit_in — **เงินเข้า** |
| `bonus` | numeric | NULL | — | โบนัส — **เงินเข้า** |
| `fixed_deposit` | numeric | NULL | — | ฝากประจำ — **เงินเข้า**. ⚠️ ใน dump = 0 ทุก row (อาจไม่ได้ใช้กับ juno168) |
| `withdraw` | numeric | NULL | — | ถอนปกติ — **เงินออก** |
| `manual_out` | numeric | NULL | — | manual credit_out — **เงินออก** |
| `redeem` | numeric | NULL | — | redeem voucher/point — **เงินออก**. ⚠️ ใน dump = 0 ทุก row |
| `affiliate` | numeric | NULL | — | จ่ายค่า affiliate — **เงินออก** |
| `cashback` | numeric | NULL | — | จ่าย cashback — **เงินออก** |
| `balance` | numeric | NULL | — | snapshot ยอดคงเหลือ (เก็บตรงจาก scrape, ไม่ derive จาก fields อื่น) |
| `created_at` | timestamp | NULL | `CURRENT_TIMESTAMP` | |
| `project_id` | varchar(50) | NULL | `'juno168'` | ⚠️ default tenant — single project? |

## Constraints

- PK: `id`
- ไม่มี FK
- ไม่มี UNIQUE (report_date, project_id) — ซ้ำได้?

## Sequence

- `report_summary_daily_id_seq`

## Source

Scrape โดยตรงจากหน้า dashboard ของเว็บเกม (ไม่ได้ derive จาก report_* tables). ใช้เปรียบเทียบ ground truth ของเว็บเกม กับยอดที่ Fixlo เก็บ (slip pipeline + manual ops).

## Formula (ใน [src/actions/dashboard.ts:186](src/actions/dashboard.ts#L186))

```
total_deposits    = deposit + manual_in + bonus + fixed_deposit
total_withdrawals = withdraw + manual_out + redeem + affiliate + cashback
```

`balance` = snapshot ยอด (ไม่ derive จาก fields อื่น — เก็บตามที่ scrape มา).

## ต้อง grill

- `juno168` default — **ปัจจุบัน reporting ยังเป็น single-tenant** (juno168 อย่างเดียว). multi-tenant อยู่ใน slip pipeline ([[transactions]]/[[projects]]) แล้ว แต่ report_* ยังไม่ทัน
- field `redeem`, `fixed_deposit`, `affiliate`, `cashback` mapping field ไหนใน dashboard?
- ทำไมไม่ unique `(report_date, project_id)` — re-scrape เก็บ history?
