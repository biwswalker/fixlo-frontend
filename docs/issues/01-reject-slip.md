## What to build

เพิ่มความสามารถให้ admin ปฏิเสธ (reject) สลิปที่ไม่ถูกต้องออกจาก pending match queue พร้อมระบุเหตุผล สลิปที่ถูก reject ยังคงอยู่ใน DB เพื่อ audit trail แต่ไม่โผล่ใน pending list อีก

**Schema:**
- เพิ่ม `'REJECTED'` เข้า `transactions.matching_status` CHECK constraint
- เพิ่ม columns: `reject_reason text`, `rejected_by text`, `rejected_at timestamp` ใน `transactions`

**Logic:**
- เพิ่ม `'REJECTED'` เข้า `TxnStatus` และ `'reject'` เข้า `TxnAction` ใน transaction state machine
- Transitions: `PENDING_REVIEW → reject → REJECTED`, `UNMAPPED → reject → REJECTED`
- `REJECTED` เป็น terminal state (ไม่มี transition ออก)
- Permission: owner + admin (เหมือน confirm_mapping)

**Action:**
- `rejectTransaction(transactionId, reason, customNote?)` — ตรวจ permission, เรียก state machine, UPDATE transactions

**UI:**
- เพิ่มปุ่ม "ปฏิเสธ" (reject) ข้างปุ่ม "ยืนยัน" ใน PendingMatchesTable
- เปิด dialog ที่มี dropdown preset reasons + free text เมื่อเลือก "อื่นๆ"
- Preset options: สลิปซ้ำ / ยอดผิด / ผิด project / test slip / อื่นๆ

## Acceptance criteria

- [ ] Admin สามารถ reject slip ที่มี status PENDING_REVIEW หรือ UNMAPPED ได้
- [ ] Reject dialog แสดง preset 5 ตัว — เลือก "อื่นๆ" แล้วต้องกรอก free text จึงจะ submit ได้
- [ ] หลัง reject: matching_status = REJECTED, reject_reason และ rejected_by บันทึกใน DB
- [ ] Slip ที่ถูก reject ไม่โผล่ใน pending match list อีก
- [ ] Slip ที่ถูก reject ไม่นับใน reconciliation outflow (เพราะ query filter AUTO_MAPPED/MANUAL_MAPPED อยู่แล้ว)
- [ ] State machine: AUTO_MAPPED → reject → invalid-transition (ไม่อนุญาต)
- [ ] Non-admin (staff/viewer) → forbidden
- [ ] Tests ใน `transactionState.test.ts` ครอบคลุม reject transitions ทุก path

## Blocked by

None — can start immediately
