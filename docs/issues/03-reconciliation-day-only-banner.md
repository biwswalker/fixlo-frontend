## What to build

ปรับหน้า reconciliation ให้เหลือ day view เท่านั้น และทำให้ banner "มีรายการรอ match" แสดงเฉพาะเมื่อวันที่ที่กำลังดูอยู่มี pending slips จริงๆ (filter ด้วย transfer_at::date)

**Changes:**
- ลบ `PeriodSelector` component ออกจากหน้า reconciliation (period=day เสมอ)
- แก้ `getPendingMatchCount(projectId, date?)` ให้รับ optional date param — ถ้ามี date ให้ filter `transfer_at::date = date`
- หน้า reconciliation ส่ง `targetDate` เข้า `getPendingMatchCount` เสมอ
- Banner link เปลี่ยนจาก `/dashboard/${projectId}/match` เป็น `/dashboard/${projectId}/match?transferDate=${targetDate}`

## Acceptance criteria

- [ ] หน้า reconciliation ไม่มี period selector อีก (day only)
- [ ] Banner "มีรายการรอ match" โผล่เฉพาะวันที่เลือกมี pending slips (transfer_at::date ตรงกัน)
- [ ] วันที่ไม่มี pending → banner ไม่โผล่ แม้จะมี backlog ค้างวันอื่น
- [ ] Banner link พา admin ไปหน้า match พร้อม `?transferDate=YYYY-MM-DD` pre-filled
- [ ] Tests: `getPendingMatchCount` with date filter

## Blocked by

None — can start immediately
