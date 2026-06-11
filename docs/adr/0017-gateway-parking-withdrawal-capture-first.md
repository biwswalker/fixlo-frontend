---
id: "0017"
title: Gateway parking withdrawal — capture-first per-transaction model
status: accepted
date: 2026-06-11
tags: [scraper, apay, parking, treasury, capture-first]
---

# ADR 0017 — Gateway parking withdrawal: capture-first per-transaction model

## Context

Apay merchant portal (`linkdeepcode.me`, login `accteam001` = "ACCTEAM") มีหน้า
"Merchant Withdrawal list" (`merchant-withdraw.php`) ที่โชว์ **ราย transaction** ของการ
โยกเงินถอนออกจาก gateway มาพัก/เก็บที่ master account ของโปรเจกต์เอง — ไม่ใช่จ่าย player.
เรียกว่า **Gateway parking withdrawal** (รายการโยกเงินพัก).

ของนี้ต่างจาก 2 concept ที่ชื่อใกล้กัน:
- **Withdrawal slip** ([[transactions]]) — จ่าย player ผ่าน Discord slip pipeline, AI-extracted
- **`report_apay_daily.withdrawal_amount`** — daily aggregate จาก Payment Summary card (ADR 0009/0016)

withdraw list เป็น per-transaction มี timestamp + orderID + destination account + ยอด
(request/refund/amount/fee) + status. portal ส่ง HTML table ต่อวันที่เลือก (`date0`/`date1`
รูป DD/MM/YYYY).

ปัญหา: จะเก็บข้อมูลนี้ยังไงให้ idempotent, จะผูกกับ master account ตอนไหน, และจะเข้า
reconciliation formula เลยมั้ย — โดยที่ตอนนี้ยังไม่เห็นเลขจริงในระบบ.

## Decision

### 1. Capture-first — reconciliation deferred

Phase นี้ **เก็บ data ดิบอย่างเดียว ยังไม่เข้าสูตรใดๆ** (ไม่แตะ KPI, account breakdown,
ส่วนต่าง). ตาม precedent ADR 0009 (cross-check-only) → ADR 0016 (เข้าสูตร): ใช้งานจริง
เห็นเลขก่อน ค่อยออกแบบ formula impact. การ grill formula ตอนยังไม่มีข้อมูลจริง = เดาลอย.

### 2. Table ใหม่ `gateway_parking_withdrawals` — per-transaction grain

ไม่ยัดเข้า [[transactions]] — คนละ provenance (gateway portal ไม่ใช่ Discord slip),
คนละ pipeline (scraper ไม่ใช่ spectre worker), คนละ semantics (parking ไม่ใช่ player payout).

ไม่ aggregate เป็น daily เหมือน `report_apay_daily` — portal ให้ราย transaction +
status เปลี่ยนได้ราย row, aggregate จะทำให้ track status + audit ไม่ได้.

| Column | ที่มา / ความหมาย |
|---|---|
| `order_id` | OrderID (เช่น `WITM080620261E9A6BE378`) — natural key |
| `project_id` | จาก scraper config (1 login = 1 project) |
| `account_number`, `account_name` | destination master account — **raw text** (ดู §4) |
| `request_amount` | "Request" — ยอดขอถอน (gross) |
| `refund_amount` | "Refund" — ยอดหัก/คืน |
| `amount` | "Amount" — **canonical** สุทธิเข้า master (= request − refund) |
| `fee_amount` | "fee" |
| `transfer_at` | row datetime → UTC (ดู §5) |
| `status` | raw text (ดู §6) |

P2P% + Bank icon = ทิ้ง (matching quality / redundant กับ account).

### 3. Idempotency — `UNIQUE(project_id, order_id)` ON CONFLICT DO UPDATE

scraper รันซ้ำได้ (retry, ชนรอบ). **status เปลี่ยนได้หลัง scrape** (Pending→Approved) →
`ON CONFLICT (project_id, order_id) DO UPDATE` overwrite status + amounts ด้วยค่าล่าสุด.
ใช้ `project_id` ใน key เผื่อ orderID ไม่ global unique.

### 4. Destination account — raw text ก่อน, FK ทีหลัง

เก็บ `account_number` + `account_name` เป็น raw text ตอน capture. **ไม่** resolve เป็น
`project_account_id` FK ตอน scrape — เพิ่ม nullable FK column ทีหลังตอน reconciliation
phase. ตอน capture ไม่แบก matcher logic + ไม่เสี่ยง null block การ insert.

### 5. transfer_at — Bangkok → UTC

portal row datetime เป็น Bangkok local. แปลงเป็น UTC ISO ก่อน INSERT ตาม
[[transfer_at timezone invariant]] (column `timestamp without time zone` = UTC-naive).
consistent กับ [[transactions]] + [[manual_transactions]].

### 6. Status — เก็บทุกค่า raw, filter ทีหลัง

scrape เก็บ **ทุก status เป็น raw text** ไม่ filter ตอน capture. เหตุผล:
- status เปลี่ยน Pending→Approved → ถ้าไม่เก็บ Pending ตอนแรก, รอบ update จะหา row ไม่เจอ
- reconciliation phase ค่อย filter `status='Approved'` (เงินเข้า master จริง) — เหมือน
  [[transactions]] เก็บ REJECTED ไว้ audit ไม่ลบ
- ยังไม่ enumerate ค่า status ทั้งหมด → เก็บ string, ไม่ทำ enum ตอนนี้

### 7. Scraping — extend single Playwright process เดิม

reuse session ของ Apay scraper (login เดียว = auth risk เดียว, สำคัญเพราะ portal มี
CAPTCHA/ban risk — ADR 0009 §7). ตรงกับเหตุผล single-process เดิม (session อยู่ใน memory):

```
23:45  login ครั้งเดียว (+ CAPTCHA via Gemini Vision)
23:59  fetch balance + payment summary  → daily_balances + report_apay_daily  (เดิม)
       sleep ข้ามเที่ยงคืน
~00:05 fetch withdraw list             → gateway_parking_withdrawals          (ใหม่)
```

`date0=date1` = **freeze ตอน 23:45** (วันที่เริ่มรัน = วันที่เพิ่งปิด) ไม่ใช่คำนวณตอน fetch
หลังเที่ยงคืน — ไม่งั้น `today()` กลายเป็นคนละวัน. fetch หลัง 00:01 เพราะวันเพิ่งปิด
list ครบ (ถ้าดึง 23:59 ยังมี pending ค้าง).

## Open questions — reconciliation phase 2 (RESOLVED by ADR 0018)

> Phase 2 ออกแบบเสร็จแล้วใน [ADR 0018](0018-parking-carve-out-reconciliation.md)
> (carve-out formula). implementation ยัง gate ที่ data จริงไหลก่อน. ส่วนล่างคือ
> mental model เดิมที่ grill ไว้ — เก็บไว้เป็น context:

- **parking = decomposition ไม่ใช่ addition.** master bank account รับเงิน 2 ทาง:
  (1) ตรงจาก player, (2) parking sweep. `balance_delta` = total รวม 2 ทาง. parking capture
  ค่าทาง (2) → แยกได้ว่า player-inflow = `balance_delta + outflow − parking_in`.
- **เป้าหมายอนาคต** = redefine `ยอดรับ` ให้เป็น **player-only** (carve parking ออก) → ทำให้
  `ยอดเข้าระบบ(สลิป)` (card 2) เทียบกับ `ยอดเข้าระบบ(เว็บ)` (card 1, player-side) แม่นขึ้น
  (apples-to-apples). master เป็น **mixed account** (รับทั้ง player + parking) → ต้อง carve
  per-account ไม่ใช่ตัดทั้งบัญชี.
- **ทำไม defer**: แตะ formula + KPI card = กระทบ ADR 0016, เสี่ยง double-count กลับด้าน;
  ยังไม่เห็นเลขจริงว่า parking สัดส่วนเท่าไหร่. → phase นี้คง formula เดิม ไม่แตะ, parking
  เป็น data ดิบใน table เฉยๆ. ค่อยเปิด ADR ใหม่ตอน carve-out จริง.

## Consequences / risks

- **Session ต้องอยู่รอดข้ามเที่ยงคืน** (~15-20 นาทีเพิ่มจาก 23:59→00:05). ถ้า apay portal
  session timeout สั้นกว่านี้ → withdraw fetch ล้ม (แต่ balance/summary เซฟไปแล้ว).
- **Process crash ช่วง sleep** → คืนนั้นไม่ได้ withdraw list. single nightly cron ไม่มี
  auto-retry → ต้องมี manual re-run path (idempotent ผ่าน ON CONFLICT รองรับ re-run อยู่แล้ว).
- **Destination account ยังไม่ผูก master** → data ใช้ใน reconciliation ไม่ได้ทันที, ต้องรอ
  phase FK + matcher. ยอมรับ (capture-first).
- **status raw string ไม่ normalize** → query ต้องรู้ค่าจริงเอง จนกว่าจะ enumerate + ทำ enum.

## Alternatives considered

- **ยัดเข้า [[transactions]]** — ปฏิเสธ: คนละ provenance/pipeline/semantics, ทำให้ slip
  matching + edit/delete policy (ADR 0011) ปนเปื้อน.
- **Aggregate เป็น daily เหมือน `report_apay_daily`** — ปฏิเสธ: เสีย per-transaction status
  tracking + audit; aggregate ตอน status ยังเปลี่ยนได้ = เลขไม่นิ่ง.
- **Resolve `project_account_id` FK ตอน scrape** — เลื่อน: เพิ่ม matcher ใน scraper +
  เสี่ยง null block insert; capture-first ไม่ต้องการ.
- **เข้าสูตร reconciliation เลย** — เลื่อน: ยังไม่เห็นเลขจริง, double-count risk กับ
  withdrawal slip / report_apay_daily ยังประเมินไม่ได้ (ADR 0016 §Consequences เตือนไว้).
- **Cron แยกหลังเที่ยงคืน (login ใหม่)** — ปฏิเสธ: เพิ่ม login = เพิ่ม CAPTCHA/ban risk;
  reuse session เดิมปลอดภัยกว่า.
- **Filter เฉพาะ Approved ตอน scrape** — ปฏิเสธ: status mutable, ON CONFLICT ต้องหา row
  เดิม (Pending) เจอตอน update.
