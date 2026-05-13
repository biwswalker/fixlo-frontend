## What to build

เพิ่ม tab "Manual Balance" ใน AddAdjustmentDialog เพื่อให้ admin กรอก daily balance ด้วยมือเมื่อ operator ไม่ได้ส่งภาพ statement ผ่าน Discord

**Schema:**
- เพิ่ม `source text DEFAULT 'discord' CHECK (source IN ('discord', 'manual'))` ใน `daily_balances`

**Action:**
- `createManualBalance(projectAccountId, date, balanceAmount, note?)` → UPSERT `daily_balances` (conflict on `date + project_account_id`) with `source = 'manual'`, `matching_status = 'MANUAL_MAPPED'`

**UI:**
- เพิ่มเนื้อหา tab "Manual Balance" ใน AddAdjustmentDialog (tab structure มีแล้วจาก issue #6)
- Form: project_account (dropdown required), date (required), balance_amount (required), note (optional)

## Acceptance criteria

- [ ] Admin กรอก manual balance ได้จาก tab "Manual Balance"
- [ ] Manual balance บันทึกใน `daily_balances` ด้วย `source = 'manual'`
- [ ] หากวันนั้นมี balance เดิม (discord) อยู่แล้ว → UPSERT อัปเดตค่า (manual override)
- [ ] `actualBalance` ใน reconciliation summary ใช้ค่า manual balance ถ้ามี (เพราะ query เดิม ORDER BY date DESC LIMIT 1 ครอบคลุมแล้ว)
- [ ] `source = 'discord'` สำหรับ rows เดิมทั้งหมด (migration backfill)

## Blocked by

#6 (dialog tab structure สร้างใน issue #6)
