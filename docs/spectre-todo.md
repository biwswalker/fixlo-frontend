# Spectre (Discord Bot + Worker) — TODO

สิ่งที่ต้องแก้ใน `fixlo-spectre` เพื่อรองรับฟีเจอร์ใหม่จาก issues #44–#50 และ schema debt ที่ค้างอยู่

Repo: https://github.com/biwswalker/fixlo-spectre

---

## 🔴 Required — ต้องทำก่อน deploy frontend features

### 1. Filter `deleted_at IS NULL` ในการ query project_accounts

**ทำไม:** issue #45 เพิ่ม soft-delete (`deleted_at`) ให้ `project_accounts`. Worker ใช้ query project_accounts เพื่อทำ Smart Matching — ถ้าไม่ filter บัญชีที่ถูก soft-delete ออก อาจ match slip ไปหาบัญชีที่ retire แล้ว

**แก้ที่:** query ใน `worker.js` ที่ SELECT project_accounts มาทำ smartMatch → เพิ่ม `WHERE deleted_at IS NULL`

---

### 2. `daily_balances` INSERT: เพิ่ม `source = 'discord'` อย่างชัดเจน

**ทำไม:** issue #50 เพิ่ม `source` column ใน `daily_balances` (DEFAULT `'discord'`). ถ้า worker ไม่ระบุ column นี้ใน INSERT ก็จะได้ DEFAULT ถูกต้องอยู่แล้ว — แต่ควร explicit ไว้เพื่อ clarity และป้องกัน DEFAULT เปลี่ยนในอนาคต

**แก้ที่:** `worker.js` ส่วน INSERT daily_balances → เพิ่ม `source = 'discord'` ใน INSERT columns/values

---

## 🟡 Risk — ต้องตัดสินใจก่อน deploy

### 3. Duplicate detection: Discord slip ซ้อน Manual transaction

**สถานการณ์:** admin สร้าง manual transaction สำหรับการโอนวันที่ X เพราะ operator ลืมส่ง Discord → แต่ต่อมา operator ส่งสลิปจริงผ่าน Discord → worker INSERT `transactions` ใหม่ → reconciliation นับสองครั้ง

**ปัจจุบัน:** Worker ตรวจ duplicate ด้วย `ref_id` UNIQUE constraint ใน `transactions` เท่านั้น ไม่ได้ cross-check กับ `manual_transactions`

**ทางเลือก:**
- **A (แนะนำ):** ไม่แก้ worker — admin ใช้ปุ่ม Reject (issue #44) เพื่อ reject Discord duplicate หลัง manual entry สร้างแล้ว เป็น operational process
- **B:** Worker ตรวจ `manual_transactions` ก่อน INSERT — ถ้าพบ row ที่ `transfer_at` และ `amount` ตรงกัน → skip หรือ set UNMAPPED พร้อม flag

ตัดสินใจเลือก A หรือ B ก่อน deploy issue #44 + #49

---

## 🟢 Carry-over — schema debt ที่ค้างจาก CONTEXT.md

items เหล่านี้วางแผนไว้แล้วใน migration plan แต่ยังไม่ได้ทำใน spectre

### 4. [worker.js:266-268] 0-amount bug

```js
// ปัจจุบัน (incorrect)
aiOutput.amount ? ...
// แก้เป็น
aiOutput.amount != null ? ...
```

ป้องกัน slip ที่ยอด = 0 ถูก skip

### 5. Drop QR code path ใน worker

หลัง migration 014 drop QR columns แล้ว worker ยังมี code ที่ insert `qr_amount`, `qr_code_text`, `is_amount_mismatch`, `is_amount_verified` อยู่ → ตัดออก ไม่งั้น INSERT error

**แก้ที่:**
- ตัด `extractQRCodeData` function
- ตัด `jsQR` import
- ลบ qr-related params ออกจาก INSERT transactions
- ถอด `jsqr` ออกจาก package.json (อย่าถอด `sharp` เพราะ bot.js ยังใช้ resize)

### 6. bot.js Fuse.js threshold ลด false-positive

**ปัจจุบัน:** threshold 0.3 → false-positive บ่อยเมื่อ project shortnames ใกล้กัน

**แก้:** threshold → 0.1 + เพิ่ม strict prefix pattern `#<project>` หรือ exact match-only สำหรับ cross-project lending detection

### 7. Worker populate `transfer_at` จาก `aiOutput.date + aiOutput.time` พร้อม timezone ที่ถูกต้อง

หลัง migration 012 consolidate transfer_at แล้ว worker ต้อง insert `transfer_at` = `aiOutput.date + aiOutput.time` แทน `transfer_date` + `transfer_time` แยก

**ปัญหาที่พบจากข้อมูลจริง:** `transactions.transfer_at` แสดงเป็น `17:00:00 UTC` ทุก row = `00:00 Bangkok (UTC+7)` — หมายความว่า worker ไม่ได้ใช้ `aiOutput.time` จริง หรือ combine ผิด timezone ทำให้ frontend แสดง `00:00` ทุก slip

**แก้ที่:** worker ส่วน build `transfer_at` ก่อน INSERT:
- ถ้า `aiOutput.time` มีค่า (เช่น `"14:35"`) → combine กับ `aiOutput.date` เป็น `"YYYY-MM-DD HH:mm"` ใน timezone `Asia/Bangkok` แล้วแปลงเป็น UTC ก่อน INSERT
- ถ้า `aiOutput.time` เป็น null/undefined → fallback เป็น `00:00 Bangkok` พร้อม log warning
- ห้าม default เป็น `new Date(aiOutput.date)` เปล่าๆ — JS parse date-only string เป็น UTC midnight ซึ่ง = `17:00 UTC` = `00:00 Bangkok` ทำให้เวลาหายทุกกรณี

*(ตรวจสอบว่า migration 012 deploy พร้อมกับ worker update นี้แล้วหรือยัง)*

---

## Deploy Order (เมื่อพร้อม)

1. Stop spectre worker
2. Run DB migrations (frontend repo)
3. Deploy spectre (items 1, 2, 4, 5, 7 พร้อมกัน)
4. Deploy fixlo-frontend (issues #44–#50 ตามลำดับ)
5. Resume worker
6. ตัดสินใจ item 3 (duplicate handling) ก่อนหรือหลัง deploy ก็ได้ แต่ต้อง communicate กับทีม ops
