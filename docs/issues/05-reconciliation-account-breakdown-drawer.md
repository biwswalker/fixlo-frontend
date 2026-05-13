## What to build

ปรับตาราง "รายละเอียดการจ่ายแยกตามบัญชี" ให้แสดง ธนาคาร/เลขบัญชีของ master account และเพิ่ม slip detail drawer ที่เปิดได้เมื่อคลิกแถวบัญชี

**Type changes:**
- เพิ่ม fields ใน `AccountLevelStat`: `accountId: string`, `bankCode: string`, `accountNumber: string | null`

**Query changes:**
- `rawTxSql` JOIN กับ `project_accounts` เพื่อดึง `bank_code`, `account_number` มาด้วย

**New server action:**
- `getAccountSlips(accountId, date)` → query `transactions` ที่ `project_account_id = accountId` และ `transfer_at::date = date`, matching_status IN ('AUTO_MAPPED','MANUAL_MAPPED'). Return: `Array<{ source: 'discord', transfer_at, sender_name, sender_bank, sender_account, ai_amount, ref_id, image_path }>` (phase นี้ Discord เท่านั้น — issue #6 จะขยาย)

**UI:**
- Column ชื่อบัญชีใน table แสดง bank_code + account_number (masked `*XXXX`) ใต้ชื่อ
- คลิก row → เปิด Drawer/Sheet ทางขวา
- Drawer แสดงตารางสลิปเรียงตาม transfer_at: เวลา, ชื่อผู้โอน, ธนาคาร, เลขบัญชีผู้โอน, จำนวน, Ref ID, ปุ่มดูรูปสลิป
- Row "Unmapped" ไม่มี drill-down (ไม่มี accountId)

## Acceptance criteria

- [ ] ตาราง account breakdown แสดง bank_code และ account_number masked ใต้ชื่อแต่ละ account
- [ ] คลิก account row → Drawer เปิดแสดง slip list ของบัญชีนั้นวันนั้น
- [ ] Slip list เรียงตาม transfer_at ascending
- [ ] ปุ่มดูรูปสลิปใน drawer เปิด dialog รูปภาพได้
- [ ] Row "Unmapped" ไม่มี click handler / drill-down
- [ ] `getAccountSlips` test: return Discord slips เท่านั้น, เรียงตามเวลา

## Blocked by

None — can start immediately
