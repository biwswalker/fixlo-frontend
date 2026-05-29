---
title: หน้าปัดหลัก (Dashboard)
type: guide
tags: [system, page, dashboard]
route: /dashboard/[projectId]
---

# หน้าปัดหลัก — `/dashboard/[projectId]`

> สรุปกระแสเงินสดและรายรับ-รายจ่ายของ project ในช่วงเวลาที่เลือก. ทุก role เข้าได้.

Source code: [src/app/dashboard/[projectId]/page.tsx](src/app/dashboard/[projectId]/page.tsx)
Server actions: [src/actions/dashboard.ts](src/actions/dashboard.ts) → `getDashboardSummary`, `getDailyChartData`

## URL params

| ชื่อ | ความหมาย | ค่า default |
|---|---|---|
| `projectId` (path) | ชื่อ project หรือ `all` | `all` ถ้าไม่ระบุ |
| `from` (query) | วันเริ่มต้น `YYYY-MM-DD` | 7 วันก่อน `today` |
| `to` (query) | วันสิ้นสุด `YYYY-MM-DD` | `today` |
| `page` (query) | หน้าของ pagination | `1` |
| `query` (query) | search keyword | — |

## โครงสร้างหน้า

```
┌────────────────────────────────────────────────────────────┐
│  คลังข้อมูลโครงการ: <displayTitle>           [ส่งออก] [ยืนยันยอด] │
├────────────────────────────────────────────────────────────┤
│  Section 1 — KPI Cards (3 ใบ)                              │
│  [กระแสเงินสดสุทธิ] [ยอดฝากรวม] [ยอดถอนรวม]                  │
├────────────────────────────────────────────────────────────┤
│  Section 2 — รายละเอียดรายรับ-รายจ่าย (2 columns)             │
│  รายรับ (Income)            │  รายจ่าย (Expense)              │
│  - ฝากเงิน + breakdown       │  - ถอนเงิน + breakdown          │
│  - เติมมือ                   │  - ถอนมือ                       │
│  - โบนัส                     │  - แลกรางวัล                    │
│  - ฝากประจำ                  │  - พันธมิตร                     │
│                              │  - คืนยอดเสีย                    │
├────────────────────────────────────────────────────────────┤
│  Section 3 — Cashflow Chart (รายวัน)                        │
│  Bar chart: deposits (เขียว) + withdrawals (แดง)             │
│  Line: net diff                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Section 1 — KPI Cards

ดึงข้อมูลผ่าน `getDashboardSummary(projectId, from, to)`. คำนวณช่วง `[from, to]` (default 7 วัน).

### 1.1 กระแสเงินสดสุทธิ (Net Cashflow)

**ตัวเลขที่แสดง**: `formatBaht(netCashflow)` — สีเขียว ถ้า ≥ 0, แดงถ้า < 0

**สูตร**:
```
netCashflow = totalDeposits − totalWithdrawals
```

**ที่มา**:
- `totalDeposits` = ยอดฝากรวม (ดูใบที่ 2)
- `totalWithdrawals` = ยอดถอนรวม (ดูใบที่ 3)

### 1.2 ยอดฝากรวม (Total Deposit)

**ตัวเลขที่แสดง**: `formatBaht(totalDeposits)`

**SQL** (ผ่าน `depositTotalSql` ใน `src/lib/kpiSql.ts`):
```sql
SELECT COALESCE(SUM(amount), 0) as total
FROM (
  SELECT amount FROM report_deposits
    WHERE status = 'สำเร็จ'
      AND trans_date::date BETWEEN $1 AND $2
      AND project_id = $3
  UNION ALL
  SELECT amount FROM report_manual_credit_in
    WHERE trans_date::date BETWEEN $1 AND $2
      AND project_id = $3
) _deposit_combined
```

กรอง `project_id integer FK` (migration 041). ที่มา: [[../db/tables/report_deposits|report_deposits]].

### 1.3 ยอดถอนรวม (Total Withdrawal)

**ตัวเลขที่แสดง**: `formatBaht(totalWithdrawals)`

**SQL** (alias `summaryQuery`):
```sql
SELECT COALESCE(SUM(withdraw + manual_out + redeem + affiliate + cashback), 0) as total_withdrawals
FROM report_summary_daily
WHERE (project_id = $1 OR $2 = true)
  AND report_date::date BETWEEN $from AND $to
```

**องค์ประกอบของยอดถอนรวม** (จาก [[../db/tables/report_summary_daily|report_summary_daily]]):
- `withdraw` — ถอนปกติของ player
- `manual_out` — ถอนเครดิตด้วยมือ ([[../db/tables/report_manual_credit_out|report_manual_credit_out]])
- `redeem` — แลกของรางวัล/รางวัลออก
- `affiliate` — จ่ายค่าคอมพันธมิตร
- `cashback` — คืนยอดเสีย

> ยอดถอนรวม = ผลรวม **ฝั่งเงินออกทั้งหมด** ของเว็บเกม (ไม่ใช่แค่ withdraw ของ player).

---

## Section 2 — รายละเอียดรายรับ-รายจ่าย

ดึงข้อมูลผ่าน `getDashboardSummary` (call ครั้งเดียว, ใช้ Section 1 และ 2 ร่วมกัน). ทุกค่ามาจาก [[../db/tables/report_summary_daily|report_summary_daily]] **ยกเว้น** `deposit` ที่ override จาก [[../db/tables/report_deposits|report_deposits]].

### 2.1 ฝั่งรายรับ (Income)

| Label | field | ที่มา | สูตร |
|---|---|---|---|
| ฝากเงิน (Deposit) | `summary.deposit` | [[../db/tables/report_deposits|report_deposits]] | `SUM(amount) WHERE status='สำเร็จ'` (เหมือน "ยอดฝากรวม") |
| เติมมือ (Manual In) | `summary.manualIn` | [[../db/tables/report_summary_daily|report_summary_daily]] | `SUM(manual_in)` |
| โบนัส (Bonus) | `summary.bonus` | [[../db/tables/report_summary_daily|report_summary_daily]] | `SUM(bonus)` |
| ฝากประจำ (Fixed Deposit) | `summary.fixedDeposit` | [[../db/tables/report_summary_daily|report_summary_daily]] | `SUM(fixed_deposit)` |

**totalIncome** (ใช้คำนวณ % ของ progress bar):
```
totalIncome = deposit + manualIn + bonus + fixedDeposit
```

#### Deposit Breakdown (ใต้ "ฝากเงิน")

แสดงรายการแยกตามบัญชี master ที่รับเงิน. SQL:
```sql
SELECT web_acc as account, COALESCE(SUM(amount), 0) as total
FROM report_deposits
WHERE trans_date::date BETWEEN $from AND $to
  AND status = 'สำเร็จ'
GROUP BY web_acc
ORDER BY total DESC
```

`web_acc` = string ที่ scraper เก็บ. Format มี 3 แบบ ระบบจะแปลงเป็นชื่อสวยงามด้วย `formatAccountName`:
- `"123456 | ชื่อบัญชี"` → `"ชื่อบัญชี (123456)"`
- `"123456ชื่อบัญชี"` → `"ชื่อบัญชี (123456)"`
- `"123456"` (ตัวเลขล้วน) → `"ธนาคารไทยพาณิชย์ (123456)"`

ผลลัพธ์ aggregate รวมตามชื่อ formatted แล้ว sort `total DESC`.

กรอง `project_id = $N` เหมือน Section 1.2 ผ่าน `idOrAll`.

### 2.2 ฝั่งรายจ่าย (Expense)

| Label | field | ที่มา | สูตร |
|---|---|---|---|
| ถอนเงิน (Withdraw) | `summary.withdraw` | [[../db/tables/report_summary_daily|report_summary_daily]] | `SUM(withdraw)` |
| ถอนมือ (Manual Out) | `summary.manualOut` | [[../db/tables/report_summary_daily|report_summary_daily]] | `SUM(manual_out)` |
| แลกรางวัล (Redeem) | `summary.redeem` | [[../db/tables/report_summary_daily|report_summary_daily]] | `SUM(redeem)` |
| พันธมิตร (Affiliate) | `summary.affiliate` | [[../db/tables/report_summary_daily|report_summary_daily]] | `SUM(affiliate)` |
| คืนยอดเสีย (Cashback) | `summary.cashback` | [[../db/tables/report_summary_daily|report_summary_daily]] | `SUM(cashback)` |

**totalExpense**:
```
totalExpense = withdraw + manualOut + redeem + affiliate + cashback
```

> ตรงนี้แหละที่ "ยอดถอนรวม" ใน Section 1 มาจาก — เป็นยอดเดียวกับ `totalExpense`.

#### Withdrawal Breakdown (ใต้ "ถอนเงิน")

```sql
SELECT web_acc as account, COALESCE(SUM(amount), 0) as total
FROM report_withdrawals
WHERE trans_date::date BETWEEN $from AND $to
  AND status = 'สำเร็จ'
GROUP BY web_acc
ORDER BY total DESC
```

ที่มา: [[../db/tables/report_withdrawals|report_withdrawals]]. แปลงชื่อบัญชีเหมือน deposit breakdown.

กรอง `project_id = $N` ผ่าน `idOrAll` เช่นกัน.

### Progress bar — % ใน label

```
percentage = (amount / total) * 100
```
- ฝั่งรายรับ ใช้ `totalIncome` เป็น denominator
- ฝั่งรายจ่าย ใช้ `totalExpense` เป็น denominator

---

## Section 3 — Cashflow Chart (รายวัน)

ดึงผ่าน `getDailyChartData(projectId, from, to)`. แสดง bar chart + line chart.

**SQL** (ผ่าน `depositPerDaySql` + `withdrawPerDaySql` ใน `src/lib/kpiSql.ts`):
```sql
-- deposits per day
SELECT trans_date::date::text AS day_date, COALESCE(SUM(amount), 0) AS total
FROM (
  SELECT trans_date, amount FROM report_deposits
    WHERE status = 'สำเร็จ'
      AND trans_date::date BETWEEN $1 AND $2
      AND project_id = $3
  UNION ALL
  SELECT trans_date, amount FROM report_manual_credit_in
    WHERE trans_date::date BETWEEN $1 AND $2
      AND project_id = $3
) _deposit_daily
GROUP BY trans_date::date ORDER BY trans_date::date ASC;

-- withdrawals per day
SELECT trans_date::date::text AS day_date, COALESCE(SUM(amount), 0) AS total
FROM report_withdrawals
WHERE status = 'สำเร็จ'
  AND trans_date::date BETWEEN $1 AND $2
  AND project_id = $3
GROUP BY trans_date::date ORDER BY trans_date::date ASC;
```

Merged ใน `mergeDailyChartRows` (JS) เป็น `{day, deposits, withdrawals, netDiff}`.

**ที่มาของแต่ละแท่ง/เส้น**:

| ตัวเลข | ที่มา | สูตร |
|---|---|---|
| `deposits` (แท่งเขียว) | [[../db/tables/report_deposits|report_deposits]] กรอง `status='สำเร็จ'` | `SUM(amount)` ต่อวัน |
| `withdrawals` (แท่งแดง) | [[../db/tables/report_summary_daily|report_summary_daily]] | `withdraw + manual_out + redeem + affiliate + cashback` ต่อวัน |
| `netDiff` (เส้น) | คำนวณ inline | `deposits − withdrawals` |

ทั้ง deposits และ withdrawals กรอง `project_id = $3` ตาม project ที่เลือก.

`day` field แปลงเป็นชื่อวัน อังกฤษย่อ (`Mon`, `Tue`, …) ด้วย `Intl.DateTimeFormat("en-US", { weekday: "short" })`.

---

## ปุ่ม "ส่งออกข้อมูล" / "ยืนยันยอดวันนี้"

ทั้งคู่อยู่ใน UI แต่ **ยังไม่ implement** (ปุ่ม static, ไม่มี handler). ดู [src/app/dashboard/[projectId]/page.tsx:81-91](src/app/dashboard/[projectId]/page.tsx#L81-L91).

## ⚠️ ความเสี่ยง / Bug ที่ควรรู้

1. ~~**ยอดฝาก + breakdown ไม่กรอง project_id**~~ — **Resolved**: ทุก query กรอง `project_id = $N` ผ่าน `idOrAll` / `kpiSql.ts` แล้ว.
2. **`status = 'สำเร็จ'` hardcoded ภาษาไทย** — ถ้า scraper เปลี่ยน label → ตัวเลขเป็น 0
3. **`totalDeposits` (Section 1) override `summary.deposit` (Section 2)** ด้วยค่าเดียวกัน — แต่ทั้งคู่มาจาก [[../db/tables/report_deposits|report_deposits]] ไม่ใช่ `report_summary_daily.deposit`. ดังนั้น progress bar ของ "ฝากเงิน" จะเทียบกับ totalIncome ที่มี deposit ใหญ่ผิดสัดส่วนกับ field อื่นถ้าข้อมูลคนละช่วง
