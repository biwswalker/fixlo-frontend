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

---

## 🔵 ADR 0005 — Balance matcher v2 support (cross-repo issue fixlo-spectre#3)

Items นี้ unblock matcher v2 path P0 (acc_num) และลด false-positive platform bonus. Frontend ship ไปก่อนได้ — `acc_num` null → skip P0 graceful

### 8. Gemini schema: เพิ่ม `acc_num` สำหรับ BALANCE-type images

**ทำไม:** Matcher v2 ใช้ `acc_num` เป็น P0 (priority สูงสุด — exact match → score 100). แก้ Mode B (null `account_name` + valid platform เช่น TrueMoney 2 masters พิมผะกา/อังคณา แยกไม่ได้)

**Type:** `string | null`. รับเลขที่ visible ในภาพรวม masked digits (`"06*-***-7141"`, `"629-0-xxx759"`). Frontend normalize ด้วยการ strip `-`, `*`, `x`, whitespace ก่อน compare

**แก้ที่:** worker.js — Gemini prompt + schema สำหรับ `BALANCE | BANK_APP_BALANCE | GATEWAY_BALANCE`. **อย่า reuse `r_num`/`s_num`** — พวกนั้น SLIP type sender/receiver, null บน BALANCE อยู่แล้ว

### 9. Persist `acc_num` ไปที่ `daily_balances`

2 option:

- **A (แนะนำ):** เพิ่ม column ใหม่ `daily_balances.account_number text NULL` — query/index ได้ ขนาน `account_name`/`platform`
- **B (iteration แรกได้):** ส่งลง `raw_ai_output.acc_num` เฉยๆ — Frontend matcher อ่าน jsonb ตรงๆ. Defer column ทีหลัง

ไม่ต้อง backfill rows เก่า — `batchReRunBalanceMatch` skip P0 อัตโนมัติเมื่อ field ว่าง

### 10. Platform misreads — ลด false-positive

**ข้อมูล production (2026-05-16):**

- Row 87: `acc_name="เกษม ติะแสนเทพ"` (master BBL) แต่ `platform="KBANK"`
- Rows 95, 102, 88: `acc_name="คุณ ศุณิษา"`/`"คุณ ศุญิษา"` (master BBL) แต่ `platform="KTB"`

**ปัญหา:** เมื่อ matcher v2 fuzzy-match name สำเร็จ + platform เพี้ยน → +10 bonus ไปบัญชีผิด → false-positive AUTO_MAPPED

**ทางเลือก:**

- Cross-check `platform` กับ visible bank logo / app chrome
- ถ้า model ไม่มั่นใจ → emit `null` แทน guess. Matcher handle null platform graceful (no bonus, no penalty); wrong value แย่กว่า null
- Confidence threshold บน Gemini output, หรือ allowlist mapping free-form output → canonical `project_accounts.bank_code`

### Coordination

- Items 8+9 = gating Mode B. Frontend ship ก่อนได้, pick up อัตโนมัติ next `batchReRunBalanceMatch`
- Item 10 ลด false-positive หลัง fuzzy name match เริ่มจับ rows ที่เคย UNMATCHED. ถ้า item 10 ยังไม่ landed → mitigation = AUTO_THRESHOLD=85 cutoff + name-partial=80 (bonus ต้องมาจาก somewhere เพื่อข้าม threshold)
- ดู [ADR 0005](https://github.com/biwswalker/fixlo-frontend/blob/main/docs/adr/0005-balance-matcher-v2.md) สำหรับ frontend side

### Out of scope

- GSB ไม่มี master ใน `project_accounts` → domain question (GSB legit operating?) ไม่ใช่ OCR/matcher issue
- SLIP-type OCR (sender/receiver name + number) — ใช้ได้แล้ว ไม่อยู่ scope
