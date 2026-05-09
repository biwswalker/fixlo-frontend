---
title: Fixlo CONTEXT
type: context
tags: [domain, glossary]
---

# Fixlo — Domain context

> ⚠️ Skeleton. ค่อยๆ เติมจาก grill session. ดู [[docs/db/MOC]] สำหรับ schema reference.

## Domain

**Fixlo = iGaming reconciliation system.** กระทบยอด/reconcile รายการเงินของ casino online (deposit, withdraw, bonus, credit, cashback, redeem). ลูกค้าเป็น brand เกม (เช่น `juno168`). Operator ส่งภาพสลิปผ่าน Discord, AI อ่านยอด, match กับบัญชี master ของแต่ละโปรเจกต์, แล้วรวมยอดเทียบกับรายงานจากเว็บเกม.

## Glossary

ยังไม่ resolved. รอ grill:

- **Fixlo** — ชื่อผลิตภัณฑ์ (product name)
- **Spectre** — codename ภายในของ DB/version (เลข `090526` ใน backup file = วันที่ dump 2026-05-09)
- **juno168** — ชื่อ project ลูกค้า/tenant (ใช้เป็น default ใน [[report_summary_daily]].`project_id`)
- **Project** — โปรเจกต์ลูกค้าใน [[projects]] table; ผูก Discord channel
- **Project account** — บัญชีธนาคารใน [[project_accounts]] (= master account ของโปรเจกต์)
- **Cross-project lending** — โปรเจกต์ A ยืมเงินจากบัญชีของโปรเจกต์ B
  - `source_project_id` = เจ้าของบัญชี (ได้รับ/มีสลิป)
  - `target_project_id` = ผู้ยืมเงิน (เอาเงินไปใช้)
  - `source == target` = รายการ internal (ฝาก/ถอนของ project ตัวเอง)
- **Active date** ([[projects]].`active_date`) — anchor สำหรับ scraping job (ดึงข้อมูล external API ตั้งแต่วันนั้น) ไม่ใช่วันสร้าง project
- **Master account** — ปรากฏใน [[manual_adjustments]] — relation กับ project_account?
- **Member user** (`member_user`) — ผู้เล่น (player) ในเว็บเกม
- **Amb user** (`amb_user`) — **Ambassador** / agent / ตัวแทนหัวหน้า affiliate.
  - ⚠️ Format ของ code **ไม่ stable** — prefix `84ks<project>...` พบในบาง project เท่านั้น. อย่าใช้ regex parse infer project. ต้องใช้ mapping/source อื่นในการระบุ project ของ report_* row.
- **Staff user** (`staff_user`) — พนักงานฝั่งเว็บเกม (operator) ที่ทำรายการ — ไม่ใช่ admin ของ Fixlo
- **Fixlo user** ([[users]] table) — ⚠️ **deprecated**. Auth ปัจจุบันมาจาก external API. Roles ใน external API ใช้ lowercase `owner|admin|staff|viewer`. ตาราง `users` รอลบ.
- **Slip** — ภาพสลิปธนาคาร — เก็บ [[raw_uploads]] → [[transactions]]
- **Matching** — process จับคู่สลิปกับ project_account ([[transactions]].matching_status)
- **Daily balance** — yอด snapshot ใน [[daily_balances]]
- **Bonus** — ของแถม/โปรโมชัน. ฟรีเครดิต, มีเงื่อนไข turn over
  - [[report_manual_bonus_in]] = จ่ายโบนัสให้ player
  - [[report_manual_bonus_out]] = ดึงโบนัสคืน (ผิดเงื่อนไข?)
- **Credit** — ยอดเล่นจริง (เงินลูกค้า). ฝาก/ถอนได้
  - [[report_manual_credit_in]] = เพิ่มเครดิตด้วยมือ
  - [[report_manual_credit_out]] = หักเครดิตด้วยมือ
- **Manual adjustment** ([[manual_adjustments]]) — ปรับยอดของ **master account** (ฝั่ง Fixlo / project_account) เมื่อ reconcile ไม่ตรง. ต่างจาก `report_manual_*` ที่ปรับยอดของ **player**.
- **Master account** — บัญชีหลักของโปรเจกต์ (= [[project_accounts]]). ใช้รับ deposit/จ่าย withdraw.
- **`bank_code`** ไม่ใช่ธนาคารจริงเสมอไป — รวม e-wallet (`TRUEMONEY`), crypto exchange (`BINANCE`), underground payment gateway (`Apay`, `DPay`, `Badoo`, `Wealth.wave`). อย่าถือ `bank_code` เป็น "ธนาคาร" — มันคือ "ช่องทางรับ-ส่งเงิน".
- **Aliases** — JSON-encoded array เก็บเป็น text ใน `project_accounts.aliases`; ใช้ fuzzy match กับ sender/receiver name ของสลิป.

## Bounded contexts

1. **Slip pipeline (trigger-based batch)** — repo: https://github.com/biwswalker/fixlo-spectre
   - **Staff ส่งภาพ slip การโอนออก (withdrawal)** ใน Discord channel ของ project ตัวเอง
     - **เก็บเฉพาะ withdrawal slip** (master → player) — deposit ไม่ผ่าน slip pipeline (มาจาก scrape เว็บแทน)
     - ถ้าระบุ project ปลายทางในข้อความ (cross-project lending) bot ใช้ Fuse.js fuzzy search หา target_project_id
   - Discord bot (`bot.js`) ดักภาพ → save disk → INSERT raw_uploads (status `PENDING`)
   - Staff trigger batch ด้วยข้อความ:
     - `"สลิปการโอนออก วันที่ DD/MM/YYYY"` → set `projects.active_date` + รัน worker
     - `"รันคิว"` → รัน worker
   - Worker (`worker.js`) ใช้ BullMQ + Redis, concurrency=1:
     - SELECT PENDING uploads → enqueue jobs (attempts=3, exponential backoff)
     - แต่ละ job: ดึงรูป → Gemini AI extract (`type, amount, ref, s_*, r_*, date, time, acc_name, platform`) + jsQR decode QR amount
     - AI fallback chain: `gemini-3.1-flash-lite-preview` → `gemma-4-31b-it` → `gemma-4-26b-a4b-it` (Ollama disabled)
     - Route by `aiOutput.type`:
       - `BALANCE | BANK_APP_BALANCE | GATEWAY_BALANCE` → INSERT [[daily_balances]]
       - `SLIP` → smartMatch(sender) กับ project_accounts → INSERT [[transactions]] (duplicate check ด้วย `ref_id`)
       - `UNKNOWN` → ignore
     - UPDATE `raw_uploads.ai_status = 'PROCESSED' | 'ERROR'`
   - **Match input = sender (`s_*`)** เพราะ master เป็นคนโอนออก = sender ของ slip

2. **Reporting**: scrape/API integration จากเว็บเกม → `report_*` tables → [[report_summary_daily]] (รวมยอดเทียบกับ slip pipeline).
   - ⚠️ **ปัจจุบัน single-tenant: juno168 เท่านั้น** — ยังไม่มี project_id ใน report_deposits/withdrawals/manual_*. การ multi-tenant จะต้อง add column ก่อน.

3. **Identity & admin**: [[users]] (Fixlo admin), role enum

4. **Manual ops**: [[manual_adjustments]] (ปรับ master), `report_manual_credit_*` / `report_manual_bonus_*` (ปรับ player)

## Schema debt (known)

-3. **Dead columns ใน [[transactions]]** — drop ได้:
   - `image_hash` (1/525 rows; bot ใช้แค่ใน filename ไม่ insert)
   - `is_time_anomaly` (ไม่มี code เซ็ต)

-2. **QR feature deprecated** — drop columns `qr_amount`, `qr_code_text`, `is_amount_mismatch`, `is_amount_verified` จาก [[transactions]]. spectre worker ก็ตัด jsQR + related logic ทิ้ง.

-1. **Worker bugs** ที่จะ patch:
   - [worker.js:266-268] `aiOutput.amount ? ...` → `aiOutput.amount != null ? ...` (เคส 0)
   - [worker.js:274] match อาจต้อง update logic ตาม [ADR 0001](docs/adr/0001-unified-fuzzy-account-matcher.md)
   - Worker drop `aiOutput.date/time` — ใช้ทำ `transfer_at` แทน

0. **Project naming ไม่ consistent**: [[projects]].`project_name` = `juno` แต่ใน `report_summary_daily.project_id` ใช้ `juno168` (= ชื่อเต็ม canonical). ต้อง rename `projects.project_name` ให้ตรงชื่อเต็ม. Projects อื่น (uno, gaza, yb) อาจ shortname เหมือนกัน — ต้อง audit.

1. **`project_id` type ไม่ตรงกัน** — [[projects]].id = integer, แต่ [[project_accounts]] / [[manual_adjustments]] / [[report_summary_daily]] ใช้ `project_id varchar` (เก็บ project code เช่น `'juno168'`) → ไม่มี FK. เกิดจาก schema พัฒนา ad-hoc ยังไม่ได้ตามไปแก้.
2. **PK type ปนกัน** — uuid (users, project_accounts, manual_adjustments) vs integer + sequence (projects, raw_uploads, transactions, daily_balances, report_*).
3. **`transactions.transfer_date` + `transfer_time varchar(20)` แยก** — แทนที่จะเป็น timestamp เดียว. **Plan: merge เป็น `transfer_at timestamp`** (รอทำ migration).
   - แย่กว่านั้น: 2 write paths ใช้ field คนละชุด — bot/worker fills `record_date` (= active_date ของ project), UI manual fills `transfer_date/transfer_time`. Query ที่ filter ด้วย `transfer_date` จะ miss rows จาก worker. ต้อง unify schema.
4. **[[daily_balances]] ใช้ `project_name text`** — ไม่ใช่ FK.
5. **Matching logic** — แก้แล้ว (ADR 0001 accepted):
   - `fixlo-spectre/lib/smartMatcher.js` = production source of truth
   - `fixlo-frontend/src/lib/smartMatcher.ts` = ported จาก spectre logic 1:1 (bank normalize ไทย, gateway/person split, TrueMoney case, JSON.parse aliases)
   - `fixlo-frontend/src/lib/accountMatcher.ts` = ลบทิ้งแล้ว
   - `AddAdjustmentDialog` โหลด accounts จาก DB แทน hardcoded list
   - `reconciliation.ts` JOIN project_accounts กับ adjustments ตาม uuid → bucket ตาม account_name (UNMAPPED → "Unmapped")
   - ระยะถัดไป: extract เป็น shared package เพื่อกัน drift

## Open questions

ดูในแต่ละ table doc, section "ต้อง grill".
