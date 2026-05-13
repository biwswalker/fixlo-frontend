## What to build

เพิ่ม transfer date filter บนหน้า Match เพื่อให้ admin กรองรายการ pending ตามวันที่โอนได้ รองรับ redirect จากหน้า Reconciliation ที่ส่ง `?transferDate=` มา

**Changes:**
- เพิ่ม `transferDate` query param (optional) ใน match page
- แก้ `getPendingMatches` ให้รับ `transferDate?` — ถ้ามีให้ filter `transfer_at::date = transferDate`
- เพิ่ม DatePicker UI บน match page สำหรับเลือก transferDate (clear ได้ → กลับเป็น "แสดงทั้งหมด")
- Default (ไม่มี param) = แสดงทุก pending ไม่ filter วัน (พฤติกรรมเดิม)

## Acceptance criteria

- [ ] Match page เปิดโดยไม่มี param → แสดงทุก pending (พฤติกรรมเดิม ไม่ regression)
- [ ] Match page เปิดด้วย `?transferDate=2026-05-08` → แสดงเฉพาะ pending ที่ `transfer_at::date = 2026-05-08`
- [ ] DatePicker บน match page เลือกวันได้ → URL update → list refresh
- [ ] Clear date → กลับแสดงทุก pending
- [ ] Redirect จากหน้า reconciliation (issue #3) ผ่าน `?transferDate=` → filter ทำงานถูกต้อง

## Blocked by

None — can start immediately
