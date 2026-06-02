---
id: "0016"
title: Apay gateway figures into reconciliation table and KPIs (supersedes 0009 cross-check-only)
status: accepted
date: 2026-06-02
supersedes: ["0009 §1 (cross-check-only), §Alternatives"]
tags: [reconciliation, apay, gateway, kpi]
---

# ADR 0016 — Apay gateway figures into reconciliation table and KPIs

## Context

ADR 0009 ตั้งใจกัน `report_apay_daily.deposit_amount`/`withdrawal_amount` ออกจากทุกสูตร —
แสดงเป็น informational panel ("ข้อมูล Apay Gateway (Cross-check)") เหนือตาราง account breakdown
เท่านั้น. เหตุผลเดิม: deposit ของ gateway เป็น gateway-side ปนกับ `report_manual_credit_in`
(game-side) → กลัวตัวเลขเสีย; และ withdrawal แทนสูตร balance จะ debug ยากเพราะ formula
ต่างจาก account อื่น.

ในทางปฏิบัติ operator ต้องการอ่าน ยอดจ่าย / ยอดคงเหลือ / ยอดรับ ของ Apay **ในที่เดียวกับ
account อื่น** (ตาราง "รายละเอียดการจ่ายแยกตามบัญชี") และให้ตัวเลข Apay เข้ายอดรวมจริง —
ไม่ใช่ panel แยกที่ต้องเทียบเอง. panel แยกถูกมองว่าเป็น dead-end ที่ไม่มีใครรวมยอดต่อ.

## Decision

### 1. Apay เข้าตาราง — replace semantics

แถว Apay ใน account breakdown ใช้ `report_apay_daily` (scraper>discord priority,
reuse `buildApayStatsQuery`) เป็น **source of truth** แทน slip/balance formula:

| Column | แถว Apay |
|---|---|
| ยอดจ่ายระบบ (systemOutflow) | "—" (gateway ไม่ใช่ slip) |
| Manual | "—" |
| ยอดจ่ายสุทธิ (effectiveOutflow) | `withdrawal_amount` |
| ยอดคงเหลือ เปิด/ปิด | จาก `daily_balances` (display-only, ไม่เข้าสูตร) |
| ยอดรับ | `deposit_amount` (replace formula `(balance_D − balance_(D-1)) + outflow`) |

`fee_amount` + เวลา scrape **ไม่แสดง**. มี badge "📊 จากรายงาน" + source (scraper/discord)
เพื่อบอก provenance.

### 2. เข้ายอดรวมทั้งหมด (grand total + KPI)

Apay `withdrawal_amount`/`deposit_amount` SUM เข้า:
- total row ของตาราง (ยอดจ่ายสุทธิ, ยอดรับ) — แต่ **ไม่เข้า** total ของ column ยอดจ่ายระบบ/Manual
- KPI card 2 "ยอดเข้าระบบ(สลิป)" (slipInflow += deposit)
- KPI card 3 outflow — **ต้อง relabel** (เลิกใช้ "ยอดจ่ายจากสลิป" เพราะรวม gateway แล้ว)
- KPI card 4 "ส่วนต่าง" (auto ผ่าน slipInflow)

card 1 "ยอดเข้าระบบ(เว็บ)" = `expectedInflow` (report_deposits) **ไม่แตะ** — ยังเป็น web-side ล้วน.

### 3. No-report fallback

ไม่มี `report_apay_daily` row วันนั้น (scraper ล้ม + ไม่มี discord) → แถว Apay โชว์
"—/ไม่มีรายงาน". **ไม่ fallback** ไป balance formula (gateway เป็น truth เดียวของแถวนี้).

### 4. Scope

เฉพาะ **Apay** (มีแค่ `report_apay_daily`). gateway อื่น (Badoo/DPay/Wealth.wave)
ยังพฤติกรรมเดิม. เฉพาะ **single-project** — `projectId='all'` ข้าม merge (ชื่อ account
ACCTEAM ชนข้ามโปรเจกต์ + source priority ต่อโปรเจกต์).

### 5. Panel เดิม

ลบ `ApayGatewayCrossCheck` + การเรียก `getApayDailyStats` ใน page (ย้าย logic เข้า
report builder).

## Consequences / risks

- **Double-count กับ card 1**: ถ้า deposit ของ Apay ปรากฏใน `report_deposits` (web side, card 1)
  ด้วย → ส่วนต่าง (card 4) เปลี่ยนความหมาย: เทียบ web-deposit กับ (slip-inflow + Apay-gateway-deposit)
  ที่อาจนับ deposit เดียวกันสองทาง. นี่คือความเสี่ยงที่ ADR 0009 เตือนไว้ — รับทราบและยอมรับ
  เพื่อแลกกับ single-table UX. ถ้าตัวเลขเพี้ยน ให้กลับมาทบทวนข้อนี้ก่อน.
- KPI cards ไม่ใช่ slip/balance-derived ล้วนอีกต่อไป — label ต้องสะท้อน (card 3 relabel).
- balance เปิด/ปิด ของแถว Apay กลายเป็น decorative (ไม่เข้าสูตร) — อาจสับสนว่าทำไมไม่ตรงกับ
  ยอดรับ ที่โชว์. badge + ADR นี้คือคำอธิบาย.

## Alternatives considered

- **คงตาม ADR 0009 (cross-check panel แยก)** — ปฏิเสธ: operator ต้องรวมยอดเอง, panel เป็น dead-end.
- **Display ในแถวแต่ไม่ SUM เข้า total** — ปฏิเสธ: ผู้ใช้ต้องการยอดรวมจริง.
- **Add (effectiveOutflow += withdrawal, ยอดรับ = balance_delta + withdrawal)** — ปฏิเสธ:
  balance ของ Apay = Deposit Wallet + Withdrawal Wallet (สอง wallet) ไม่ใช่ deposit−withdrawal
  ของ transaction → balance_delta ไม่ reliable, สูตรจะให้ตัวเลขเพี้ยน. replace ตรงกว่า.
- **Generalize ทุก gateway** — เลื่อน: มีแค่ Apay ที่มี report table; ออกแบบให้ generalize ภายหลังได้.
