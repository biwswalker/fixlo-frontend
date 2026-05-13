## What to build

สร้างหน้าจัดการ project accounts ที่ `/dashboard/[projectId]/accounts` ให้ owner/admin สามารถ CRUD บัญชีธนาคารของแต่ละ project ได้จาก UI โดยไม่ต้องเข้า DB โดยตรง

**Schema:**
- เพิ่ม `deleted_at timestamp NULL` ใน `project_accounts` (soft delete)

**Actions:**
- `createProjectAccount(projectId, accountName, bankCode, accountNumber, aliases[])` → INSERT
- `updateProjectAccount(id, accountName, bankCode, accountNumber, aliases[])` → UPDATE
- `softDeleteProjectAccount(id)` → SET deleted_at = now() — block ถ้ามี transaction ผูกอยู่ (matching_status != REJECTED, count > 0)
- แก้ `getProjectAccounts` ให้ filter `WHERE deleted_at IS NULL`

**UI:**
- หน้า `/dashboard/[projectId]/accounts` แสดงตารางบัญชีทั้งหมดของ project นั้น
- ปุ่ม "เพิ่มบัญชี" เปิด form สร้าง
- แต่ละ row มีปุ่ม edit และ delete
- Form: account_name (required), bank_code (required), account_number (optional), aliases (tag input — กรอกแล้ว Enter เพิ่ม tag)
- Delete: แสดง error ถ้ามี transaction ผูกอยู่

## Acceptance criteria

- [ ] Admin สร้าง project account ใหม่ได้ และโผล่ใน dropdown ของหน้า match ทันที
- [ ] Admin แก้ไข aliases ผ่าน tag input ได้ — add/remove tag แต่ละตัว
- [ ] Soft-delete: account ที่ถูกลบไม่โผล่ใน dropdown match/reconciliation อีก
- [ ] Soft-delete บัญชีที่มี mapped transaction → แสดง error message ชัดเจน, ไม่ลบ
- [ ] Soft-delete บัญชีที่ไม่มี transaction → สำเร็จ
- [ ] หน้านี้ redirect ถ้า role เป็น staff หรือ viewer
- [ ] Tests: `softDeleteProjectAccount` ครอบคลุม success path และ blocked-by-transaction path

## Blocked by

None — can start immediately
