---
title: "PRD: Reconciliation & Match Page Enhancements"
status: ready-for-agent
date: 2026-05-13
---

# PRD: Reconciliation & Match Page Enhancements

## Problem Statement

ทีม operations ต้องทำงานกับ reconciliation ทุกวัน แต่พบปัญหาหลายจุด:

1. **ไม่มีหน้าจัดการบัญชี** — project_accounts ถูก insert ผ่าน DB โดยตรง ทีมไม่สามารถเพิ่ม/แก้/ลบบัญชีผ่าน UI ได้ รวมถึงไม่สามารถแก้ aliases ที่มีผลต่อความแม่นของ Smart Matching
2. **ไม่มีทางปฏิเสธสลิปที่ผิด** — สลิปที่ซ้ำ / ยอดผิด / ส่งผิด project ค้างอยู่ใน pending list ตลอดไป ไม่มี action ให้ admin ตัดออก
3. **Reconciliation ขาดรายละเอียด** — ตาราง "รายละเอียดการจ่ายแยกตามบัญชี" แสดงแค่ชื่อบัญชี ไม่มีธนาคาร/เลขบัญชี และไม่มีทาง drill-down ดูว่าบัญชีนั้นมีสลิปอะไรบ้างในวันนั้น
4. **Banner "รอ match" ไม่ context-aware** — แสดงตลอดเวลาที่มี backlog ค้าง ไม่สัมพันธ์กับวันที่กำลังดูอยู่
5. **ไม่มีทาง input สลิป/ยอดด้วยมือ** — เมื่อ operator ไม่ได้ส่งสลิปผ่าน Discord ไม่มีช่องทางกรอกข้อมูลเข้าระบบเลย ทำให้ reconciliation ขาดข้อมูล

## Solution

เพิ่ม 5 ฟีเจอร์เข้าหน้า Match และ Reconciliation:

1. หน้า CRUD สำหรับจัดการ project accounts ของแต่ละ project
2. ปุ่ม Reject พร้อมระบุเหตุผลบนหน้า Match
3. ปรับ Reconciliation ให้ day-only, banner context-aware, ตารางบัญชีแสดงธนาคาร/เลขบัญชี + drill-down drawer
4. Manual Entry Dialog บนหน้า Reconciliation รองรับ Manual Slip และ Manual Balance
5. Match page รองรับ date filter (transfer_at) เพื่อ redirect จาก Reconciliation ได้

## User Stories

1. As an admin, I want a dedicated page to create project accounts, so that I don't need DB access to add new bank accounts for a project.
2. As an admin, I want to edit an existing project account's name, bank code, account number, and aliases, so that Smart Matching stays accurate as account details change.
3. As an admin, I want to manage aliases via a tag input UI, so that I can add/remove alternate sender names without knowing JSON syntax.
4. As an admin, I want to soft-delete a project account, so that historical reconciliation data is not broken when an account is retired.
5. As an admin, I want the system to block deletion of a project account that has transactions mapped to it, so that I don't accidentally orphan reconciliation history.
6. As an admin, I want to reject a pending slip with a reason, so that slips that are wrong/duplicate/misrouted don't permanently clog the pending match list.
7. As an admin, I want to choose a reject reason from preset options (สลิปซ้ำ / ยอดผิด / ผิด project / test slip / อื่นๆ), so that I can reject quickly without typing freeform every time.
8. As an admin, I want to optionally type a custom reject reason when choosing "อื่นๆ", so that edge cases are documented.
9. As an admin, I want rejected slips to remain in the database, so that I can audit why a slip was rejected if questioned later.
10. As an admin, I want the reconciliation page to only show data for a single day (not week/month), so that the view matches the daily operational workflow.
11. As an admin, I want the "มีรายการรอ match" banner to show only when the selected date has pending slips (by transfer_at), so that I'm not distracted by backlog from other days.
12. As an admin, I want the "มีรายการรอ match" banner to link to the match page pre-filtered to that date, so that I go directly to the relevant slips.
13. As an admin, I want the account breakdown table to show bank and account number next to each master account name, so that I can identify accounts without memorising names.
14. As an admin, I want to click on a master account row in the reconciliation table to open a slip detail drawer, so that I can see exactly which slips contributed to that account's outflow on that day.
15. As an admin, I want the slip detail drawer to list slips sorted by transfer_at, with columns: time, sender name, sender bank, sender account, amount, ref ID, and slip image link.
16. As an admin, I want the match page to have a transfer date filter, so that I can focus on pending slips from a specific day.
17. As an admin, I want the match page default view to show all pending slips (no date filter), so that I can see the full backlog when needed.
18. As an admin, I want to create a manual transaction (withdrawal slip not sent via Discord) from the reconciliation page, so that outflow data is complete even when operators forget to send slips.
19. As an admin, I want the manual transaction form to require project account, amount, and transfer date, so that the data is always meaningful for reconciliation.
20. As an admin, I want to optionally attach a slip image when creating a manual transaction, so that physical receipts can be linked when available.
21. As an admin, I want manual transactions to be immediately MANUAL_MAPPED without going through the match queue, so that they contribute to reconciliation instantly.
22. As an admin, I want to create a manual balance snapshot for a specific day from the reconciliation page, so that daily_balance data is complete when Discord balance images are missing.
23. As an admin, I want the account breakdown table to show a separate "Manual" column when there are manual transactions on the selected day, so that Discord-sourced and manually-entered outflow are distinguishable.
24. As an admin, I want the "Manual" column in the account breakdown to be hidden when there are no manual entries, so that the table stays clean on normal days.
25. As an admin, I want the slip detail drawer to include both Discord slips and manual transactions with a badge indicating the source, so that I have a complete picture of all outflow for that account that day.
26. As an admin, I want access to all the above features within the owner/admin role, consistent with existing match page permissions.

## Implementation Decisions

### Schema Changes

1. **`transactions.matching_status` CHECK constraint** — เพิ่ม `'REJECTED'` เป็น valid value. เพิ่ม column `reject_reason text` และ `rejected_by text` และ `rejected_at timestamp`.

2. **`project_accounts.deleted_at`** — เพิ่ม column `deleted_at timestamp NULL`. Row ที่มีค่านี้ถือว่า soft-deleted: ไม่โผล่ใน dropdown match/account selector, ลบได้เฉพาะเมื่อไม่มี transaction ผูกอยู่.

3. **`manual_transactions` table (ใหม่)** — แยกจาก `transactions` เพราะไม่มี Discord origin, ไม่มี AI extraction, ไม่มี raw_upload reference:
   ```
   id uuid PK,
   project_id (FK → projects.id),
   project_account_id uuid FK → project_accounts.id,
   amount numeric NOT NULL,
   transfer_at timestamp NOT NULL,
   image_path text NULL,
   note text NULL,
   created_by text NOT NULL,
   created_at timestamp DEFAULT now()
   ```
   `matching_status` ไม่จำเป็น — manual_transactions ถือว่า MANUAL_MAPPED เสมอ.

4. **`daily_balances.source`** — เพิ่ม column `source text DEFAULT 'discord' CHECK (source IN ('discord', 'manual'))` เพื่อแยก balance ที่มาจาก Discord vs admin กรอกเอง.

### Module: Transaction State Machine (`transactionState.ts`)

เพิ่ม `'REJECTED'` เข้า `TxnStatus` union type. เพิ่ม `'reject'` เข้า `TxnAction`. Transition rules:
- `PENDING_REVIEW → reject → REJECTED` (owner/admin)
- `UNMAPPED → reject → REJECTED` (owner/admin)
- `REJECTED` เป็น terminal state (ไม่มี transition ออก)

Permission: ใช้ `manage_projects` (เหมือน force_approve) หรือ `approve_transactions` — ตาม RBAC matrix ที่มีอยู่.

### Module: `rejectTransaction` server action

Server action ที่รับ `(transactionId, reason, customNote?)` — ตรวจ permission, เรียก state machine, UPDATE transactions set matching_status='REJECTED', reject_reason, rejected_by, rejected_at. Deep module: ทดสอบ isolation ได้เพราะ encapsulate state machine + permission check ครบในที่เดียว.

### Module: Project Account CRUD actions

Server actions: `createProjectAccount`, `updateProjectAccount`, `softDeleteProjectAccount`. `softDeleteProjectAccount` ต้อง check ก่อนว่าไม่มี transaction (matching_status != REJECTED, count > 0) — ถ้ามี return error แทนลบ. getProjectAccounts filter `WHERE deleted_at IS NULL`.

### Module: `getAccountSlips(accountId, date)` server action

Query รวม Discord slips (จาก `transactions`) และ Manual slips (จาก `manual_transactions`) สำหรับ account + วันที่ที่กำหนด เรียงตาม transfer_at. Return type: `Array<{ source: 'discord' | 'manual', transfer_at, sender_name?, sender_bank?, sender_account?, amount, ref_id?, image_path?, note? }>`. Deep module: interface เรียบง่าย, ทดสอบได้ง่าย, Drawer ใช้ข้อมูลนี้อย่างเดียว.

### Module: `getPendingMatchCount` (modify)

เพิ่ม parameter `date?: string` — ถ้ามี date ให้ filter `transfer_at::date = date`. Reconciliation page ส่ง targetDate เสมอ (day-only). Match page ไม่ส่ง date (count all).

### Module: Reconciliation Page (modify)

- ตัด `PeriodSelector` component ออก (period=day เสมอ)
- `AccountLevelStat` type เพิ่ม fields: `accountId: string`, `bankCode: string`, `accountNumber: string | null`, `discordOutflow: number`, `manualOutflow: number`
- `systemOutflow` เปลี่ยน semantic เป็น `discordOutflow` (Discord-only)
- `effectiveOutflow = discordOutflow + manualOutflow + adjustments`
- Manual column ใน table โผล่เฉพาะเมื่อ `manualOutflow > 0` ใน row ใดๆ

### Module: `AddAdjustmentDialog` (modify)

เปลี่ยนจาก single form เป็น 3 tabs: **Adjustment** (existing), **Manual Slip** (form ใหม่ → createManualTransaction), **Manual Balance** (form ใหม่ → createManualBalance). Share dialog shell เดียวกัน.

### Module: Manual Slip / Balance Creation actions

- `createManualTransaction(projectId, projectAccountId, amount, transferAt, imagePath?, note?)` → INSERT manual_transactions
- `createManualBalance(projectAccountId, date, amount, note?)` → INSERT/UPDATE daily_balances with source='manual', matching_status='MANUAL_MAPPED'

### Match Page (modify)

เพิ่ม `transferDate` query param (optional). ถ้ามี → filter `getPendingMatches` ด้วย `transfer_at::date = transferDate`. Default (ไม่มี param) = แสดงทุก pending. เพิ่ม DatePicker UI บน match page สำหรับเลือก transferDate.

## Testing Decisions

**Good test = ทดสอบ external behavior เท่านั้น ไม่ทดสอบ implementation details.** ดู prior art ที่ `src/lib/__tests__/transactionState.test.ts` และ `src/lib/__tests__/smartMatcher.test.ts`

**Modules ที่ควร test:**

1. **`transactionState.ts`** (extend existing tests) — test `reject` action transitions: PENDING_REVIEW → REJECTED ✓, UNMAPPED → REJECTED ✓, AUTO_MAPPED → REJECTED ✗ (invalid), REJECTED → REJECTED ✗ (terminal). Test permission: non-admin reject → forbidden.

2. **`rejectTransaction` server action** — integration test: reject valid pending transaction → matching_status = REJECTED, reject_reason stored. Attempt reject on AUTO_MAPPED → error. Non-admin → unauthorized.

3. **`getAccountSlips`** — unit test with mock DB: returns Discord + Manual entries merged, sorted by transfer_at. Empty account → empty array.

4. **`softDeleteProjectAccount`** — test: delete account with no transactions → success, deleted_at set. Delete account with mapped transactions → error, no change.

5. **`getPendingMatchCount` with date** — test: date filter returns only pending with matching transfer_at date. No date param → returns all pending.

## Out of Scope

- **Re-open rejected slip** — REJECTED เป็น terminal state สำหรับ phase นี้ ถ้าต้องการ un-reject ต้องสร้าง transaction ใหม่
- **Bulk reject** — reject ทีละรายการเท่านั้น
- **Manual transaction บน match page** — สร้างได้เฉพาะจากหน้า reconciliation
- **Multi-tenant manual_transactions** — phase นี้รองรับ single project เท่านั้น, multi-tenant rollout แยกต่างหาก
- **Image upload UI** — image_path เป็น optional text input (path/URL) ไม่ใช่ file upload widget
- **Audit log UI** — rejected/manual transactions เก็บ metadata ใน DB แต่ยังไม่มีหน้า audit log

## Further Notes

- `manual_transactions` และ `transactions` มี schema ต่างกันโดยเจตนา: transactions ผูกกับ Discord pipeline (raw_uploads, AI fields, sender_*), manual_transactions ไม่มี fields เหล่านั้น อย่า merge สองตารางเข้าด้วยกัน
- `getAccountSlips` เป็น the canonical source สำหรับ drawer — ถ้าต้องการเพิ่ม source ใหม่ในอนาคต แก้ที่ function นี้ที่เดียว
- Soft-delete ของ project_accounts ต้องการ migration แยก อย่ารวมกับ migration อื่น เพราะ `getProjectAccounts` ถูกเรียกจากหลายที่ (match, reconciliation, adjustment dialog) — ต้อง test regression ครบ
- REJECTED transactions ไม่นับใน reconciliation outflow เพราะ `rawTxSql` filter `matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')` อยู่แล้ว ไม่ต้องแก้ query
