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
- **Master account** — บัญชีหลักของโปรเจกต์ (= [[project_accounts]]). ใช้รับ deposit/จ่าย withdraw.
- **Member user** (`member_user`) — ผู้เล่น (player) ในเว็บเกม
- **Amb user** (`amb_user`) — **Ambassador** / agent / ตัวแทนหัวหน้า affiliate.
  - ⚠️ Format ของ code **ไม่ stable** — prefix `84ks<project>...` พบในบาง project เท่านั้น. อย่าใช้ regex parse infer project. ต้องใช้ mapping/source อื่นในการระบุ project ของ report_* row.
- **Staff user** (`staff_user`) — พนักงานฝั่งเว็บเกม (operator) ที่ทำรายการ — ไม่ใช่ admin ของ Fixlo
- **Fixlo user** — auth จาก external API. Roles canonical: lowercase 4 ค่า. ตาราง [[users]] + enum `user_role` ใน DB **deprecated** รอ drop
  - `owner` — root/เจ้าของระบบ. มี permission พิเศษ `manage_admins`, `manage_billing`
  - `admin` — หัวหน้างาน. ทำ ops ทุกอย่าง (manage_users, manage_projects, approve_transactions)
  - `staff` — operator. view_reports + approve_transactions (PENDING_REVIEW)
  - `viewer` — read-only. view_reports
- **Slip** — ภาพสลิปธนาคาร — เก็บ [[raw_uploads]] → [[transactions]]
- **Matching** — process จับคู่ slip/daily_balance กับ project_account. ใช้กับ [[transactions]] (slip→account) และ [[daily_balances]] (balance snapshot→account). Priority: P1 = account_name fuzzy, P2 = platform/bank_code tiebreaker. ถ้าไม่ unique → PENDING_REVIEW → admin match manual หรือ reject.
- **Rejected slip** — transaction ที่ admin ตัดสินใจ reject ออกจาก matching pool อย่างมีเหตุผล (เช่น สลิปซ้ำ, ยอดผิด, ผิด project) `matching_status = 'REJECTED'`. ไม่นับใน reconciliation outflow. ยังคงอยู่ใน DB เพื่อ audit trail. ต้องระบุเหตุผล (preset 5 ตัว + free text).
- **Match breakdown** ([[transactions]].`match_breakdown` jsonb) — top-3 candidate accounts พร้อม component score (nameMatched, accountMatched, bankMatched) ที่ smartMatcher เก็บตอน matching รัน ใช้โชว์ admin ใน Pending Account Matches table ว่าทำไมสลิปไม่ AUTO_MAPPED
- **Daily balance** — ยอดคงเหลือ end-of-day ของ master account แต่ละบัญชี เก็บใน [[daily_balances]]. staff ส่งภาพ (BALANCE type) → worker INSERT. ต้อง match กับ [[project_accounts]] (มี matching_status: UNMATCHED/PENDING_REVIEW/AUTO_MAPPED/MANUAL_MAPPED + project_account_id FK).
- **Daily balance inflow formula** — `inflow_D = balance_D - balance_(D-1) + withdrawals_D` โดย `withdrawals_D` = SUM ของ transactions.ai_amount (AUTO_MAPPED/MANUAL_MAPPED) ใน วัน D. `report_summary_daily` ใช้แสดง game-side เปรียบเทียบเท่านั้น ไม่เข้า formula.
- **ยอดรับ** (per-account inflow) — ยอดรับเงินจริงของ master account หนึ่งบัญชี สำหรับวันที่เลือก D: `ยอดรับ = (balance_D − balance_(D-1)) + effectiveOutflow_D`. ใช้ **strict date match** — ถ้าไม่มี balance ตรงวันใดวันหนึ่ง แสดงข้อความแทนตัวเลข: "ไม่มียอดคงเหลือวันที่เลือก" / "ไม่มียอดคงเหลือวันก่อนหน้า" / "ไม่มียอดคงเหลือทั้งสองวัน". สอดคล้องกับ **Daily balance inflow formula**.
- **ยอดเข้าระบบ(เว็บ)** — ยอดฝากที่สำเร็จจากระบบเว็บ = `expectedInflow` (SUM report_deposits status='สำเร็จ' + SUM report_manual_credit_in). แสดงใน KPI card slot 1 ของหน้า reconciliation. (ชื่อก่อนหน้า: "ยอดรับเข้าระบบ")
- **ยอดเข้าระบบ(สลิป)** — ยอดรับรวมทุกบัญชี คำนวณจากสลิป = SUM ของ **ยอดรับ** ทุก account ที่มีข้อมูล balance ครบทั้งสองวัน (partial sum — บัญชีที่ขาดข้อมูลไม่นับเข้า). แสดงใน KPI card slot 2 ของหน้า reconciliation.
- **ส่วนต่าง (reconciliation)** — `Math.abs(ยอดเข้าระบบ(เว็บ) − ยอดเข้าระบบ(สลิป))`. เป็นค่าบวกเสมอ. แสดงสีเขียวเมื่อ = 0 ("ยอดเว็บตรงกับยอดสลิป"), สีแดงเมื่อ ≠ 0 ("ยอดเว็บและยอดสลิปไม่ตรงกัน กรุณาตรวจสอบ"). (สูตรก่อนหน้า: expectedBalance − actualBalance — deprecated)
- **Bonus** — ของแถม/โปรโมชัน. ฟรีเครดิต, มีเงื่อนไข turn over
  - [[report_manual_bonus_in]] = จ่ายโบนัสให้ player
  - [[report_manual_bonus_out]] = ดึงโบนัสคืน (ผิดเงื่อนไข?)
- **Credit** — ยอดเล่นจริง (เงินลูกค้า). ฝาก/ถอนได้
  - [[report_manual_credit_in]] = เพิ่มเครดิตด้วยมือ
  - [[report_manual_credit_out]] = หักเครดิตด้วยมือ
- **Manual adjustment** ([[manual_adjustments]]) — **DEPRECATED** (0 rows, no new entry point). แทนที่ด้วย Slip adjustment (per-slip) และ Manual transaction (outflow ใหม่). ดู [ADR 0003](docs/adr/0003-deprecate-manual-adjustments.md).
- **Slip adjustment** — admin override ยอด AI ที่อ่านผิดบน Discord slip ที่ specific. เก็บใน `transactions.adjusted_amount` (nullable numeric) — `ai_amount` ยังคงอยู่เพื่อ audit. Fields เพิ่มเติม: `adjusted_by` (text), `adjusted_at` (timestamptz), `adjust_note` (text nullable). Reconciliation ใช้ `COALESCE(adjusted_amount, ai_amount)` เป็น effective amount.
- **`bank_code`** ไม่ใช่ธนาคารจริงเสมอไป — รวม e-wallet (`TRUEMONEY`), crypto exchange (`BINANCE`), underground payment gateway (`Apay`, `DPay`, `Badoo`, `Wealth.wave`). อย่าถือ `bank_code` เป็น "ธนาคาร" — มันคือ "ช่องทางรับ-ส่งเงิน".
- **Aliases** — JSON-encoded array เก็บเป็น text ใน `project_accounts.aliases`; ใช้ fuzzy match กับ sender/receiver name ของสลิป. จัดการผ่าน tag input UI ใน `/dashboard/[projectId]/accounts`.
- **Project account soft-delete** — [[project_accounts]] ใช้ `deleted_at timestamp` แทนการลบจริง บัญชีที่ถูก soft-delete ไม่โผล่ใน dropdown match/select แต่ยังคงอยู่ใน DB เพื่อไม่ให้ reconciliation ประวัติเสีย. ลบได้เฉพาะบัญชีที่ไม่มี transaction ผูกอยู่ — ถ้ามีต้อง block.
- **Reconciliation day-only** — หน้า reconciliation ใช้ period=day เท่านั้น (ตัด week/month/year ออก). Pending match banner filter ด้วย `transfer_at::date = targetDate` (ไม่ใช่ backlog ทั้งหมด). Banner link ไป match page พร้อม `?transferDate=YYYY-MM-DD` pre-filled.
- **Manual transaction** — รายการโอนเงินจริงที่ไม่ผ่าน Discord bot (เช่น operator ลืมส่งสลิป). เก็บใน `manual_transactions` table แยกจาก `transactions`. Fields: `project_account_id` (required), `amount` (required), `transfer_at` (required), `image_path` (optional, uploaded ผ่าน Next.js API route → volume `/app/data/spectre/manual/`), `note` (optional), `created_by`. `matching_status = MANUAL_MAPPED` ทันที — admin เลือก account โดยตรงตอนสร้าง ไม่ผ่าน Smart Matching.
- **Manual balance** — ยอดคงเหลือปลายวันที่ admin กรอกเองแทนการส่งภาพผ่าน Discord. เก็บใน `daily_balances` เดิม + `source = 'manual'`. รองรับ image upload เหมือน Manual transaction.
- **Manual entry dialog** — `AddAdjustmentDialog` มี **2 tabs**: Manual Slip / Manual Balance. (Adjustment tab ถูกลบออก — ดู [ADR 0003](docs/adr/0003-deprecate-manual-adjustments.md)). เข้าถึงได้จากหน้า reconciliation (owner + admin). Account dropdown แสดง two-line: ชื่อบัญชี / `bank_code — *last4`.
- **Account breakdown — Manual column** — ตาราง "รายละเอียดการจ่ายแยกตามบัญชี" แสดง column "Manual" เสมอ. Drill-down drawer แสดงทั้ง Discord slip และ Manual slip รวมกัน เรียงตาม `transfer_at` พร้อม badge แยกแหล่งที่มา. รูปสลิปใช้ `NEXT_PUBLIC_IMAGE_SERVER_URL + path.replace("/app/data", "")`.
- **Reconciliation outflow formula** — `effectiveOutflow = Σ COALESCE(adjusted_amount, ai_amount) [transactions] + Σ amount [manual_transactions]`. ไม่มี `manual_adjustments` component อีกต่อไป.

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

2. **Reporting** (Python scraper) — **repo 3: https://github.com/biwswalker/fixlo-scraper**
   - Stack: Playwright (undetected) + Telethon + psycopg2 + BeautifulSoup
   - Cron daily 00:30 — scrape `yesterday`. Login `app.juno168.app/upsx` ด้วย user/pass + OTP จาก Telegram (เว็บส่ง OTP เข้า Telegram chat → Telethon ดักจับ → fill `#swal2-input`)
   - Per-project config ใน `scraper_config.py` (`PROJECTS` dict). loop over active projects — เพิ่ม tenant = เพิ่ม dict entry เท่านั้น
   - Endpoints (per project): `getListsDeposit`, `getListsWithdraw`, `getListsAdminDeposit`, `getListsAdminWithdraw`, `getListsBonusDeposit`, `getListsBonusWithdraw`, `report/center/by-day` (summary)
   - แต่ละ endpoint → table ตาม config. `exclude_indices` ตัด column ที่ไม่ต้องการออกจาก HTML row
   - **Idempotent**: ทุก INSERT ใช้ `ON CONFLICT (...) DO NOTHING` (conflict targets ตรงกับ migration 015 UNIQUE constraints)
   - ⚠️ **Schema ownership: scraper code เป็น source of truth** ของ report_* tables (`init_db_table` สร้างเมื่อยังไม่มี). frontend แค่อ่าน
   - Report ผลผ่าน Discord embed ไป channel summary

3. **Identity** — auth ภายนอก (external API). [[users]] table + enum `user_role` ใน DB **deprecated** รอ drop. roles canonical = lowercase `owner | admin | staff | viewer`.

4. **Manual ops**: [[manual_adjustments]] (ปรับ master, signed amount), `report_manual_credit_*` / `report_manual_bonus_*` (ปรับ player). bonus = ฟรีโปร (ไม่ผ่านสลิป), credit = เงินจริง (มี `customer_bank` + `ref_time`).

## Schema debt (known)

-3. **Dead columns ใน [[transactions]]** — drop ได้:
   - `image_hash` (1/525 rows; bot ใช้แค่ใน filename ไม่ insert)
   - `is_time_anomaly` (ไม่มี code เซ็ต)

-2. **QR feature deprecated** — cleanup ขอบเขต:
   - DB: drop columns `qr_amount`, `qr_code_text`, `is_amount_mismatch`, `is_amount_verified` ใน [[transactions]]
   - spectre worker: ตัด `extractQRCodeData` + `jsQR` import + qr-related INSERT params
   - spectre package.json: ถอด `jsqr` (sharp ยังใช้ resize ใน bot.js — อย่าถอด)
   - frontend: ลบ UI ที่อ้างถึง qr_* (SlipReviewDialog, ตารางที่โชว์ amount mismatch)

-1. **Worker / bot bugs** ที่จะ patch:
   - [worker.js:266-268] `aiOutput.amount ? ...` → `aiOutput.amount != null ? ...` (เคส 0)
   - [worker.js:274] match อาจต้อง update logic ตาม [ADR 0001](docs/adr/0001-unified-fuzzy-account-matcher.md)
   - Worker ใช้ `aiOutput.date + aiOutput.time` populate `transfer_at` (หลัง schema migration)
   - bot.js Fuse threshold 0.3 false-positive บ่อย (project shortnames สั้นใกล้กัน) — เพิ่ม strict pattern เช่น `#<project>` หรือ exact match-only

0. **Project naming**: rename plan locked
   - `projects.id=1`: `juno` → `juno168` (UPDATE single row)
   - audit `uno`, `gaza`, `yb` (id 2-4 INACTIVE) — สมมติ `<short>168` pattern
   - canonical = full name with brand suffix (`juno168`)

1. **`project_id` type ไม่ตรงกัน** — [[projects]].id = integer, แต่ [[project_accounts]] / [[manual_adjustments]] / [[report_summary_daily]] ใช้ `project_id varchar` (เก็บ project code เช่น `'juno168'`) → ไม่มี FK. เกิดจาก schema พัฒนา ad-hoc ยังไม่ได้ตามไปแก้.
2. **PK type ปนกัน** — uuid (users, project_accounts, manual_adjustments) vs integer + sequence (projects, raw_uploads, transactions, daily_balances, report_*).
3. **`transactions` date field mess** (decided plan):
   - drop `record_date`, `transfer_date`, `transfer_time` ทั้งสาม
   - add `transfer_at timestamp` ตัวเดียว
   - worker ใช้ `aiOutput.date + aiOutput.time` มา insert. manual UI ใช้ `transfer_at` field
   - migration: backfill `transfer_at` จาก existing rows — preference: `transfer_date+transfer_time` ถ้ามี > `record_date` ถ้าไม่มี
4. **[[daily_balances]] ใช้ `project_name text`** — ไม่ใช่ FK.
8. **Canonical deposit/withdraw KPI** — ดู [ADR 0004](docs/adr/0004-deposit-withdraw-kpi-from-source-tables.md).
   - **ยอดฝากรวม** = `SUM(report_deposits.amount WHERE status='สำเร็จ')` + `SUM(report_manual_credit_in.amount)`
   - **ยอดถอนรวม** = `SUM(report_withdrawals.amount WHERE status='สำเร็จ')` + `SUM(report_manual_credit_out.amount)`
   - Defined in `src/lib/kpiSql.ts` — consumers: dashboard summary, cashflow chart, reconciliation expectedInflow.
   - `latestBalance` ยังคงอ่านจาก `report_summary_daily.balance` (actual bank balance จาก scraper — ไม่ใช่ KPI computation).
   - Cross-project withdrawal นับฝั่ง `source_project_id` (เจ้าของบัญชี) — confirmed correct. Lending counterparty (target) ไม่นับยอด

9. **Misc dead/incomplete code**:
   - [src/lib/api-client.ts](src/lib/api-client.ts) — ลบทิ้ง (axios + interceptor + signOut on 401, ไม่มี caller)
   - [src/lib/constants.ts](src/lib/constants.ts) `PROJECTS_MAP` — มีแค่ `all`. ย้ายไปโหลด projects dynamic จาก DB (label/color per project)
   - [src/middleware.ts](src/middleware.ts) `/dashboard/admin/*` guard — เก็บไว้ รอสร้าง admin section

7. **RBAC inconsistency** ที่จะ refactor:
   - 2 hasRole functions ([lib/rbac.ts](src/lib/rbac.ts) + [lib/auth.ts](src/lib/auth.ts)) — semantic ต่างกัน. Plan: เก็บ `lib/rbac.ts` (matrix-based), drop `lib/auth.ts:hasRole`
   - Server actions ใช้ hardcoded `["owner","admin"]` array — เปลี่ยนเป็น `hasPermission(role, 'approve_transactions')`
   - RBAC matrix ระบุ staff approve ได้ แต่ code blocks staff — bug, ตาม RBAC ถูก
   - Add owner-only perms: `manage_admins`, `manage_billing`

6. **Transaction state machine + verification post-QR**:
   - `matching_status`: `UNMAPPED → PENDING_REVIEW → MANUAL_MAPPED` (manual path) หรือ `→ AUTO_MAPPED` (worker path) หรือ `→ REJECTED` (admin ปฏิเสธ)
   - `is_amount_verified` = QR-only legacy. หลัง drop: ตัด filter ออกจาก reconciliation, ใช้ `matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')` เป็น trusted set
   - `forceApproveTransaction` + `approveTransaction` ปัจจุบันไม่มี role check (inconsistent กับ `addManualAdjustment`). Plan: เพิ่ม `["owner","admin"]` check ทั้งคู่

5. **Matching logic** — แก้แล้ว (ADR 0001 accepted):
   - `fixlo-spectre/lib/smartMatcher.js` = production source of truth
   - `fixlo-frontend/src/lib/smartMatcher.ts` = ported จาก spectre logic 1:1 (bank normalize ไทย, gateway/person split, TrueMoney case, JSON.parse aliases)
   - `fixlo-frontend/src/lib/accountMatcher.ts` = ลบทิ้งแล้ว
   - `AddAdjustmentDialog` โหลด accounts จาก DB แทน hardcoded list
   - `reconciliation.ts` JOIN project_accounts กับ adjustments ตาม uuid → bucket ตาม account_name (UNMAPPED → "Unmapped")
   - ระยะถัดไป: extract เป็น shared package เพื่อกัน drift

## Migration plan (Big-bang, no SLA, ตี 1-3)

Sequence:
1. Stop scraper + spectre worker
2. `pg_dump` backup
3. Run migration SQL (ตามด้านล่าง)
4. Deploy 3 repos: scraper, fixlo-spectre, fixlo-frontend
5. Verify on fresh data
6. Resume cron + worker

Migration SQL (ordered by dependency):

1. **Pre-migrate cleanup**:
   - `manual_adjustments.created_by`: `ALTER ... TYPE text` (เก็บ username string จาก external API)
   - `report_*` tables: dedupe existing + add UNIQUE (composite key per ตาราง)

2. **Drop dead/QR columns** (`transactions`):
   - `qr_amount`, `qr_code_text`, `is_amount_mismatch`, `is_amount_verified` (QR feature)
   - `image_hash`, `is_time_anomaly` (dead)

3. **Date refactor** (`transactions`):
   - `ALTER TABLE transactions ADD transfer_at timestamp`
   - Backfill: `COALESCE(transfer_date + transfer_time, record_date)` per row
   - Drop `record_date`, `transfer_date`, `transfer_time`

4. **Project rename**: `UPDATE projects SET project_name='juno168' WHERE id=1` (audit other projects ก่อน)

4.5. **Add match_breakdown column** (`transactions`):
   - `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS match_breakdown jsonb`
   - หลัง deploy: admin กด "Re-run matching" เพื่อ backfill existing PENDING_REVIEW/UNMAPPED rows

5. **Add UNIQUE constraints**:
   - `projects (discord_channel_id)` (1:1 binding)
   - `daily_balances (date, account_name)`

6. **Add CHECK**: `raw_uploads.ai_status IN ('PENDING','PROCESSED','ERROR')`

7. **Drop legacy auth**: `DROP TABLE users; DROP TYPE user_role;`

App-level changes (deploy ครั้งเดียวกับ migration):
- spectre worker: 0-amount bug fix, populate `transfer_at`, drop QR code path
- scraper: add UNIQUE-aware INSERT (ON CONFLICT DO NOTHING/UPDATE)
- fixlo-frontend: drop `is_amount_verified` filter ใน reconciliation, RBAC refactor (hasPermission), drop apiClient, PROJECTS_MAP → DB-driven, fix chart formula, merge getReconciliationStatus + getReconciliationReport
- bot.js: Fuse 0.1 + strict prefix `#<project>`
- Add UI section "Failed slips" (`ai_status='ERROR'`)

## Multi-tenant rollout (เมื่อ project อื่น active)

After main migration:
- Add `project_id` column ใน `report_*` tables (deposits, withdrawals, manual_*) — populate `'juno168'` ทุก row เก่า
- Refactor scraper เป็น config per-project (URL, credentials, Telegram session). Loop scrape ทุก active project
- Slip pipeline + login รองรับอยู่แล้ว

## Operational notes

- **Scraper**: VPS cron daily 00:30, scrape `yesterday`. Manual restart ผ่าน Discord alert
- **Backup**: manual `pg_dump` (เช่น `spectre-090526-backup`). ⚠️ ไม่มี automated/offsite — ควรเพิ่ม
- **Image storage**: bot save local disk, retention = ตลอดไป (disk ยังพอ). Tailscale IP serve
- **Discord channels**: 1:1 กับ project (จะมี UNIQUE constraint หลัง migration)

## Open questions

ดูในแต่ละ table doc, section "ต้อง grill".
