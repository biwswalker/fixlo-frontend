---
id: "0009"
title: Apay Gateway Scraper — data model and integration
status: accepted
date: 2026-05-24
tags: [scraper, apay, daily-balances, reconciliation]
---

# ADR 0009 — Apay Gateway Scraper: data model and integration

## Context

Staff ส่งภาพ balance ผ่าน Discord → spectre worker อ่าน AI → INSERT `daily_balances`. Flow นี้ lag และ error-prone (staff ลืมส่ง, AI อ่านผิด). Apay gateway มี portal ที่โชว์ balance, ยอดฝาก, ยอดถอน end-of-day ซึ่ง scrape ได้โดยตรง.

## Decision

### 1. Split ข้อมูลเป็น 2 destinations

| ข้อมูล | Destination | เหตุผล |
|---|---|---|
| `balance` (end-of-day) | `daily_balances` source='scraper' | ใช้ formula ยอดรับ เดิมได้เลย consistent กับทุก account |
| `deposit_amount`, `withdrawal_amount` | `report_apay_daily` (new table) | cross-check layer แยกออกมา ไม่ปน game-side figures |

ยอดฝากจาก Apay **ไม่** เข้าสูตร `ยอดเข้าระบบ(เว็บ)` และ **ไม่** แทนสูตร `(balance_D − balance_(D-1)) + outflow` — แสดงแยกใน reconciliation page เป็น informational cross-check เท่านั้น.

### 2. `daily_balances` — matching_status และ idempotency

- Set `matching_status = 'AUTO_MAPPED'` และ `project_account_id` ทันทีตอน insert (ไม่ผ่าน matcher) เพราะ scraper รู้ account แน่ๆ จาก config lookup
- Partial unique constraint: `UNIQUE(date, project_account_id) WHERE source = 'scraper'` → `ON CONFLICT DO UPDATE` (overwrite ด้วยค่าล่าสุด)
- `source = 'scraper'` (ไม่ใช่ `'apay_scraper'`) — source จริงๆ track ได้จาก `project_account_id → bank_code` อยู่แล้ว

### 3. `report_apay_daily` — idempotency

- `UNIQUE(date, project_account_id)` → `ON CONFLICT DO UPDATE`

### 4. project_account_id resolution

Runtime lookup: `SELECT id FROM project_accounts WHERE bank_code = 'Apay' AND project_id = 'juno168'` — ไม่ hardcode UUID ใน config (fragile ถ้า account recreate)

### 5. Timing

Single cron process รัน 23:45:
1. Login + solve CAPTCHA (Gemini Vision)
2. `time.sleep` จนถึง 23:59
3. Fetch data → INSERT ทั้ง 2 tables

ใช้ single process เพราะ Playwright session อยู่ใน memory ไม่ต้อง serialize/restore ระหว่าง cron jobs.

### 6. CAPTCHA

Gemini Vision — ใช้ API key เดียวกับ spectre worker. Retry 3 ครั้ง (refresh CAPTCHA image ใหม่แต่ละครั้ง) → ถ้าหมด retry → report Discord + stop (manual fallback: admin กรอก balance ผ่าน Manual balance dialog).

### 7. IP / Anti-bot

ลอง DO VPS ก่อน — ถ้า Cloudflare block → ย้ายไป home server (เหมือน local machine ปัจจุบัน).

## Alternatives considered

- **Apay ยอดฝาก เข้าสูตร ยอดเข้าระบบ(เว็บ)** — ปฏิเสธ เพราะ Apay ยอดฝาก = gateway-side ปนกับ `report_manual_credit_in` ซึ่งเป็น game-side = ตัวเลขเสีย
- **Apay ยอดฝาก แทนสูตร balance** — ปฏิเสธ เพราะ formula แตกต่างจาก account อื่น debug ยาก
- **source = 'apay_scraper'** — ปฏิเสธ redundant กับ project_account_id → bank_code
- **2-cron approach** (login 23:45, fetch 23:59 แยก process) — ปฏิเสธ ต้อง serialize Playwright session state ซับซ้อนเกิน
