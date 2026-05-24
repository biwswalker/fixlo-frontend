---
title: หน้ากระทบยอด (Reconciliation)
type: guide
tags: [system, page, reconciliation]
route: /dashboard/[projectId]/reconciliation
---

# หน้ากระทบยอด — `/dashboard/[projectId]/reconciliation`

> หน้าหลักของระบบ. เทียบ "ยอดที่ควรจะเป็น" (จากระบบ) กับ "ยอดจริงในธนาคาร". ถ้า variance ≠ 0 → ต้องสืบ.

Source code: [src/app/dashboard/[projectId]/reconciliation/page.tsx](src/app/dashboard/[projectId]/reconciliation/page.tsx)
Server action: [src/actions/reconciliation.ts](src/actions/reconciliation.ts) → `getReconciliationReport`

## สิทธิ์

`owner` หรือ `admin` เท่านั้น. role อื่น → redirect `/dashboard/all`.
ปุ่ม "เพิ่มรายการปรับปรุง" (manual adjustment): เฉพาะ `admin`.

## URL params

| ชื่อ | ค่า | default |
|---|---|---|
| `projectId` (path) | ชื่อ project หรือ `all` | — |
| `period` (query) | `day` / `week` / `month` | `day` |
| `date` (query) | `YYYY-MM-DD` วันใดก็ได้ในรอบนั้น | `today` |
| `page`, `limit` | สำหรับตาราง pending matches | `1`, `50` |

**การตีความช่วงเวลา**:
- `day` → `[date, date]`
- `week` → ISO week (จันทร์ถึงอาทิตย์) ที่คลุม `date`
- `month` → วันที่ 1 ถึงสิ้นเดือนของ `date`

## โครงสร้างหน้า

```
┌────────────────────────────────────────────────────────────┐
│  กระทบยอดบัญชี: <displayTitle>     [period: D|W|M] [+ปรับปรุง] │
│  📅 ข้อมูลประจำ: <formatPeriodRange()>                       │
├────────────────────────────────────────────────────────────┤
│  Section 1 — 4 Summary Cards                               │
│  [ยอดรับเข้าระบบ] [ยอดจ่ายจากสลิป] [ยอดคงเหลือธนาคาร] [ส่วนต่าง] │
├────────────────────────────────────────────────────────────┤
│  Section 2 — Pending Matches (ถ้ามี)                        │
│  ตารางรายการสลิปที่ AI match ไม่ชัด → ต้อง manual confirm     │
├────────────────────────────────────────────────────────────┤
│  Section 3 — Outflow by Master Account (ตาราง)              │
│  ลำดับ│ บัญชีหลัก │ จำนวนรายการ │ ยอดจ่ายระบบ │ ปรับปรุง │ สุทธิ │
└────────────────────────────────────────────────────────────┘
```

---

## Section 1 — 4 Summary Cards

### 1.1 ยอดรับเข้าระบบ (Expected Inflow) — สีเขียว

**ตัวเลขที่แสดง**: `formatBaht(report.expectedInflow)`

**SQL**:
```sql
SELECT COALESCE(SUM(rd.amount), 0) AS total
FROM report_deposits rd
WHERE rd.status = 'สำเร็จ'
  AND rd.trans_date::date BETWEEN $startDate AND $endDate
  AND ($isAll = true OR rd.web_acc ILIKE '%' || $projectName || '%')
```

**ที่มา**: [[../db/tables/report_deposits|report_deposits]] (จาก scraper)

**ความหมาย**: ผลรวม `amount` ของรายการฝากที่ scraper บันทึกว่า "สำเร็จ" ในช่วงนั้น. กรอง project ด้วย `web_acc ILIKE` (ไม่ใช่ `project_id` เพราะ `report_deposits` ไม่มี field `project_id`).

⚠️ **กรอง project ผ่าน `web_acc` (ชื่อบัญชี string)** — ถ้าชื่อ project ไม่อยู่ใน `web_acc` จะกรองไม่ถูก. งานนี้พึ่งพาว่า scraper ใส่ identifier ของ project ลงใน `web_acc`.

### 1.2 ยอดจ่ายจากสลิป (Expected Outflow) — สีแดง

**ตัวเลขที่แสดง**: `formatBaht(report.expectedOutflow)`

**SQL**:
```sql
SELECT COALESCE(SUM(t.ai_amount), 0) AS total
FROM transactions t
WHERE t.transfer_at::date BETWEEN $startDate AND $endDate
  AND (t.source_project_id = $projectUuid 
       OR t.target_project_id = $projectUuid 
       OR $isAll = true)
  AND t.matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')
```

**ที่มา**: [[../db/tables/transactions|transactions]] (สลิปที่ AI อ่าน + verified)

**เงื่อนไขการนับ**:
- `is_amount_verified = true` — ผ่านการยืนยันแล้ว (ไม่มี anomaly หรือ admin force-approve)
- `matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')` — รู้ว่าสลิปนี้ออกจากบัญชีไหน
- เกี่ยวข้องกับ project ผ่าน `source_project_id` (เจ้าของบัญชี) **หรือ** `target_project_id` (ผู้ยืม) — รองรับ cross-project lending

> ใช้ `ai_amount` (จำนวนเงินที่ AI อ่าน) ไม่ใช่ `amount` (ที่ user กรอก/แก้). อ้างอิง [[../db/tables/transactions|transactions]] field definitions.

### 1.3 ยอดคงเหลือในธนาคาร (Actual Balance) — สีฟ้า

**ตัวเลขที่แสดง**: `formatBaht(report.actualBalance)`

**SQL** (case `all`):
```sql
SELECT COALESCE(SUM(balance), 0) AS total
FROM (
  SELECT DISTINCT ON (project_id) balance
  FROM report_summary_daily
  WHERE report_date::date <= $endDate
  ORDER BY project_id, report_date DESC
) AS latest
```

**SQL** (case single project):
```sql
SELECT COALESCE(balance, 0) AS total
FROM report_summary_daily
WHERE project_id ILIKE '%' || $projectName || '%'
  AND report_date::date <= $endDate
ORDER BY report_date DESC
LIMIT 1
```

**ที่มา**: [[../db/tables/report_summary_daily|report_summary_daily]].`balance` — snapshot ยอด balance สิ้นวันที่ scraper บันทึก.

**ความหมาย**: ค่า `balance` ล่าสุด ณ วันที่ ≤ `endDate` (ไม่จำเป็นต้องเท่ากับ `endDate` พอดี — fallback ไป record ก่อนหน้าถ้าวันนั้นไม่มี). กรณี `all` รวมยอดทุก project (latest ของแต่ละ project แล้วบวกกัน).

⚠️ **balance ใน `report_summary_daily` ≠ balance ใน [[../db/tables/daily_balances|daily_balances]]** — `daily_balances` มาจาก slip pipeline (อ่านภาพ mobile banking), `report_summary_daily.balance` มาจาก scraper. หน้านี้ใช้ตัวหลัง.

### 1.4 ส่วนต่าง (Variance) — สีแดง/เขียวเข้ม

**ตัวเลขที่แสดง**: `formatBaht(Math.abs(report.variance))`

**สูตร**:
```
expectedBalance = startingBalance + expectedInflow − effectiveOutflowTotal
variance        = expectedBalance − actualBalance
```

**ที่มาของแต่ละองค์ประกอบ**:

| field | sql | ตาราง |
|---|---|---|
| `startingBalance` | latest `daily_balances.balance_amount` ที่ `date < startDate` | [[../db/tables/daily_balances|daily_balances]] |
| `expectedInflow` | (ดู 1.1) | [[../db/tables/report_deposits|report_deposits]] |
| `effectiveOutflowTotal` | sum ของ `effectiveOutflow` ใน Section 3 (ดูด้านล่าง) | [[../db/tables/transactions|transactions]] + [[../db/tables/manual_adjustments|manual_adjustments]] |
| `actualBalance` | (ดู 1.3) | [[../db/tables/report_summary_daily|report_summary_daily]] |

**SQL `startingBalance`** (case single project):
```sql
SELECT COALESCE(db.balance_amount, 0) AS total
FROM daily_balances db
JOIN projects p ON db.project_name = p.project_name
WHERE p.project_name ILIKE '%' || $projectName || '%' 
  AND db.date < $startDate
ORDER BY db.date DESC LIMIT 1
```

**ตีความ variance**:
- `0` → ยอดดุลถูกต้อง (UI สีเขียว)
- `≠ 0` → มีส่วนต่าง (UI สีแดง). UI แสดงค่า absolute. ถ้า positive → expected สูงกว่าจริง = เงินหายไปมากกว่าที่บันทึก. negative → expected ต่ำกว่าจริง = เงินมีมากกว่าที่ควร.

⚠️ **`startingBalance` มาจาก `daily_balances` แต่ `actualBalance` มาจาก `report_summary_daily`** — สอง source ที่ไม่ sync กัน. ถ้า scraper กับ slip-pipeline บันทึกยอดต่างกัน → variance อาจเป็น false positive.

---

## Section 2 — Pending Matches (ถ้ามี)

แสดง **เฉพาะเมื่อมี transaction ที่ status = `PENDING_REVIEW` หรือ `UNMAPPED`**.

ดึงผ่าน `getPendingMatches(projectId, page, limit)` ([src/actions/dashboard.ts](src/actions/dashboard.ts)).

**SQL**:
```sql
SELECT t.*, p.project_name
FROM transactions t
LEFT JOIN projects p ON t.source_project_id = p.id
WHERE (t.source_project_id = $projectId OR $isAll = true)
  AND t.matching_status IN ('PENDING_REVIEW', 'UNMAPPED')
ORDER BY t.created_at DESC
LIMIT $limit OFFSET $offset
```

**ความหมาย**: รายการสลิปที่ smart matcher ([src/lib/smartMatcher.ts](src/lib/smartMatcher.ts)) ไม่มั่นใจว่าออกจากบัญชี master ไหน:
- `PENDING_REVIEW` — มี possible matches แต่ confidence ต่ำ
- `UNMAPPED` — ไม่มี match ที่ใกล้เคียง

ปุ่ม **"Re-Run Matching"** → เรียก `batchReRunSmartMatch(projectId)` ที่รันคืนสำหรับทุก row แบบนี้.

ผู้ใช้สามารถเปิด dialog (`SlipReviewDialog`) → เลือก project_account → confirm ด้วย `confirmTransactionMapping(transactionId, accountId)` → ตั้ง `matching_status = 'MANUAL_MAPPED'`.

---

## Section 3 — Outflow by Master Account

ตารางแสดงยอดจ่ายแยกตามบัญชี master.

### Schema ตาราง

| คอลัมน์ | ที่มา | สูตร |
|---|---|---|
| ลำดับที่ | คำนวณ frontend | `index + 1` (zero-padded 2 หลัก) |
| ชื่อบัญชีหลัก | `pa.account_name` (ผ่าน LEFT JOIN) | unmapped → label `"Unmapped"` |
| จำนวนรายการ | `count` | นับ row ใน [[../db/tables/transactions|transactions]] ต่อบัญชี |
| ยอดจ่ายระบบ | `systemOutflow` | `SUM(t.ai_amount)` ของ transactions ที่ verified + mapped ของบัญชีนั้น |
| รายการปรับปรุง | `adjustments` | `SUM(ma.amount)` ของ [[../db/tables/manual_adjustments|manual_adjustments]] ของบัญชีนั้น |
| **ยอดจ่ายสุทธิ (Effective Outflow)** | `effectiveOutflow` | `systemOutflow − adjustments` |

> **สังเกต**: `manual_adjustments.amount` เป็น signed. **ลบ** ออกจาก systemOutflow:
> - `+amount` (เพิ่มเงินเข้าบัญชี) → ลด effectiveOutflow
> - `−amount` (หักเงินออก) → เพิ่ม effectiveOutflow

### SQL — raw transactions

```sql
SELECT COALESCE(t.adjusted_amount, t.ai_amount) AS adjusted_amount,
       t.ai_amount, t.sender_name, t.project_account_id AS account_id,
       pa.account_name, pa.bank_code, pa.account_number
FROM transactions t
LEFT JOIN project_accounts pa ON t.project_account_id = pa.id
WHERE t.transfer_at::date BETWEEN $startDate AND $endDate
  AND (t.source_project_id = $projectUuid 
       OR t.target_project_id = $projectUuid 
       OR $isAll = true)
  AND t.matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')
```

### SQL — manual adjustments

```sql
SELECT pa.account_name, ma.amount
FROM manual_adjustments ma
LEFT JOIN project_accounts pa ON pa.id::text = ma.master_account
WHERE ma.adjustment_date BETWEEN $startDate AND $endDate
  AND (ma.project_id = $projectUuid OR $isAll = true)
```

### Aggregation logic (JS, [src/actions/reconciliation.ts:281-331](src/actions/reconciliation.ts#L281-L331))

1. สร้าง `Map<accountName, {systemOutflow, adjustments, count}>`
2. Loop transactions → bucket ตาม `account_name` (null → `"Unmapped"`), บวก `ai_amount` เข้า `systemOutflow`, +1 ใน `count`
3. Loop adjustments → bucket ตาม `account_name`, บวก `amount` เข้า `adjustments`
4. แปลงเป็น array, คำนวณ `effectiveOutflow = systemOutflow − adjustments`
5. Sort `effectiveOutflow DESC`

### แถวรวมท้ายตาราง (Total Row)

```javascript
รวมจำนวนรายการ = sum(item.count)
รวมยอดจ่ายระบบ = sum(item.systemOutflow)
รวมรายการปรับปรุง = sum(item.adjustments)
รวมยอดจ่ายสุทธิ = sum(item.effectiveOutflow)
```

ค่า "รวมยอดจ่ายสุทธิ" ในแถวนี้ = `effectiveOutflowTotal` ที่ใช้ใน formula variance (Section 1.4).

---

## ปุ่ม "เพิ่มรายการปรับปรุง" (Add Adjustment)

โผล่เฉพาะ role `admin`. เปิด dialog `AddAdjustmentDialog` → เรียก `addManualAdjustment(...)`:

**INSERT**:
```sql
INSERT INTO manual_adjustments (
  project_id, master_account, amount, reason, adjustment_date, created_by
) VALUES (...)
```

- `master_account` = `project_accounts.id` (uuid as string) — เลือกบัญชีจาก dropdown
- `amount` = signed (`+` เพิ่มยอด, `-` หัก)
- `created_by` = `session.user.id`

หลัง insert → `revalidatePath` หน้านี้ → ตัวเลข Section 1.4 และ Section 3 อัปเดตทันที.
