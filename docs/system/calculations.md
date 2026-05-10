---
title: สูตรคำนวณรวม + ตัวอย่าง
type: reference
tags: [system, calculations, formulas]
---

# สูตรคำนวณ — Quick Reference

> รวมสูตรทั้งระบบในที่เดียว. ทุกสูตรชี้ source field + ที่มา.

## หน้าปัดหลัก ([[page-dashboard]])

### Net Cashflow
```
netCashflow = totalDeposits − totalWithdrawals
```
- `totalDeposits` = `SUM(report_deposits.amount)` กรอง `status='สำเร็จ'`, ในช่วง `[from, to]`
- `totalWithdrawals` = `SUM(withdraw + manual_out + redeem + affiliate + cashback)` จาก `report_summary_daily` ในช่วง `[from, to]` (กรอง project)

### Total Income (รายรับรวม)
```
totalIncome = deposit + manualIn + bonus + fixedDeposit
```
ทั้งหมดมาจาก [[../db/tables/report_summary_daily|report_summary_daily]] ยกเว้น `deposit` ที่ override จาก [[../db/tables/report_deposits|report_deposits]].

### Total Expense (รายจ่ายรวม)
```
totalExpense = withdraw + manualOut + redeem + affiliate + cashback
```
ทั้งหมดจาก [[../db/tables/report_summary_daily|report_summary_daily]].

### Progress bar %
```
percentage = (amount / total) * 100
```
total = `totalIncome` หรือ `totalExpense` ตามฝั่ง.

### Chart — netDiff รายวัน
```
netDiff[day] = deposits[day] − withdrawals[day]
```

---

## หน้ากระทบยอด ([[page-reconciliation]])

### Variance (ส่วนต่าง) — สูตรหลักของระบบ

```
expectedBalance = startingBalance + expectedInflow − effectiveOutflowTotal
variance        = expectedBalance − actualBalance
```

| ตัวแปร | ความหมาย | ที่มา |
|---|---|---|
| `startingBalance` | ยอดเริ่มต้น (ก่อนรอบนี้) | [[../db/tables/daily_balances|daily_balances]].`balance_amount` ล่าสุดที่ `date < startDate` |
| `expectedInflow` | ยอดที่ควรเข้า | `SUM(report_deposits.amount)` ในรอบ, status สำเร็จ |
| `effectiveOutflowTotal` | ยอดที่ควรออก (สุทธิ) | sum ของ `effectiveOutflow` ทุก master account |
| `actualBalance` | ยอดจริงสิ้นรอบ | [[../db/tables/report_summary_daily|report_summary_daily]].`balance` ล่าสุดที่ `≤ endDate` |

### Effective Outflow ต่อบัญชี
```
effectiveOutflow[account] = systemOutflow[account] − adjustments[account]
```
- `systemOutflow[account]` = `SUM(transactions.ai_amount)` ของ transactions ที่ verified + mapped → ตั้งกับ `account` นั้น
- `adjustments[account]` = `SUM(manual_adjustments.amount)` (signed) ของ adjustments ที่ผูกกับ `account` นั้น

### Total ของตาราง Section 3
```
รวมจำนวนรายการ        = Σ count
รวมยอดจ่ายระบบ        = Σ systemOutflow
รวมรายการปรับปรุง     = Σ adjustments
รวมยอดจ่ายสุทธิ       = Σ effectiveOutflow      ← ตัวนี้คือ effectiveOutflowTotal ในสูตร variance
```

---

## ตัวอย่างเลขจริง — กระทบยอด 1 วัน

สมมติ project `juno168`, วันที่ `2026-05-09`:

### Input
- `daily_balances` วันที่ก่อนหน้า (`2026-05-08`): `100,000` บาท → **startingBalance = 100,000**
- `report_deposits` วันที่ `2026-05-09`, status `สำเร็จ`: รวม `50,000` บาท → **expectedInflow = 50,000**
- `transactions` วันที่ `2026-05-09`, verified + mapped:
  - บัญชี A: 3 รายการ รวม `30,000` (ai_amount)
  - บัญชี B: 2 รายการ รวม `15,000`
- `manual_adjustments` วันที่ `2026-05-09`:
  - บัญชี A: `+1,000` (admin ปรับเข้าเพราะ scraper missing)
- `report_summary_daily.balance` วันที่ `2026-05-09`: `103,500` บาท → **actualBalance = 103,500**

### คำนวณ

**Section 3 — per account**

| บัญชี | systemOutflow | adjustments | effectiveOutflow | count |
|---|---:|---:|---:|---:|
| A | 30,000 | +1,000 | 29,000 | 3 |
| B | 15,000 | 0 | 15,000 | 2 |
| **รวม** | **45,000** | **+1,000** | **44,000** | **5** |

`effectiveOutflowTotal = 44,000`

**Section 1.4 — Variance**

```
expectedBalance = 100,000 + 50,000 − 44,000 = 106,000
variance        = 106,000 − 103,500         = +2,500
```

### ตีความ

`variance = +2,500` หมายความว่า **expected สูงกว่าจริง 2,500 บาท** — บัญชีจริงน้อยกว่าที่ควรจะเป็น 2,500. อาจเกิดจาก:
1. มีค่าธรรมเนียมโอนที่ไม่ได้บันทึก
2. มีรายการจ่ายออกที่ไม่มีสลิป (ยังไม่ verified)
3. scraper รายงาน balance ผิด
4. มี manual adjustment ที่ยังไม่ลง

**วิธีแก้**: admin เปิด dialog "เพิ่มรายการปรับปรุง" → เลือกบัญชี → ใส่ `amount = -2,500` (ลด systemOutflow ของบัญชีนั้น 2,500 → effectiveOutflow ลด 2,500 → expectedBalance ลด → variance = 0). หรือสืบหา transaction ที่ขาด.

---

## หน้าปัดหลัก vs หน้ากระทบยอด — ต่างกันยังไง

| มิติ | หน้าปัดหลัก | หน้ากระทบยอด |
|---|---|---|
| ยอดถอน | จาก [[../db/tables/report_summary_daily|report_summary_daily]] (รวม manual/redeem/affiliate/cashback) | จาก [[../db/tables/transactions|transactions]] (สลิปจริง, verified) |
| ยอดฝาก | [[../db/tables/report_deposits|report_deposits]] (ทุก project, ไม่กรอง) | [[../db/tables/report_deposits|report_deposits]] (กรองด้วย `web_acc ILIKE`) |
| ยอด balance | ไม่มี | [[../db/tables/report_summary_daily|report_summary_daily]].`balance` (สิ้นรอบ) + [[../db/tables/daily_balances|daily_balances]] (เริ่มรอบ) |
| Manual adjustments | ไม่ใช้ | ใช้ ([[../db/tables/manual_adjustments|manual_adjustments]]) |
| มุมมอง | "เกิดอะไรขึ้นบ้าง" (descriptive) | "ตรงไหม" (reconciliation) |

---

## Cheatsheet field → ตาราง

| field ใน UI | column DB | ตาราง | filter |
|---|---|---|---|
| ยอดฝากรวม / Deposit | `amount` | [[../db/tables/report_deposits|report_deposits]] | `status='สำเร็จ'` |
| Withdraw | `withdraw` | [[../db/tables/report_summary_daily|report_summary_daily]] | — |
| Manual In | `manual_in` | [[../db/tables/report_summary_daily|report_summary_daily]] | — |
| Manual Out | `manual_out` | [[../db/tables/report_summary_daily|report_summary_daily]] | — |
| Bonus | `bonus` | [[../db/tables/report_summary_daily|report_summary_daily]] | — |
| Fixed Deposit | `fixed_deposit` | [[../db/tables/report_summary_daily|report_summary_daily]] | — |
| Redeem | `redeem` | [[../db/tables/report_summary_daily|report_summary_daily]] | — |
| Affiliate | `affiliate` | [[../db/tables/report_summary_daily|report_summary_daily]] | — |
| Cashback | `cashback` | [[../db/tables/report_summary_daily|report_summary_daily]] | — |
| ยอดคงเหลือธนาคาร (Section 1.3 reconcile) | `balance` | [[../db/tables/report_summary_daily|report_summary_daily]] | latest ≤ endDate |
| Starting balance (variance formula) | `balance_amount` | [[../db/tables/daily_balances|daily_balances]] | latest < startDate |
| ยอดจ่ายจากสลิป / Expected Outflow | `ai_amount` | [[../db/tables/transactions|transactions]] | `is_amount_verified=true` AND `matching_status IN ('AUTO_MAPPED','MANUAL_MAPPED')` |
| รายการปรับปรุง / Adjustments | `amount` (signed) | [[../db/tables/manual_adjustments|manual_adjustments]] | `adjustment_date BETWEEN start AND end` |
| Deposit breakdown account name | `web_acc` | [[../db/tables/report_deposits|report_deposits]] | format ผ่าน `formatAccountName()` |
| Withdrawal breakdown account name | `web_acc` | [[../db/tables/report_withdrawals|report_withdrawals]] | format ผ่าน `formatAccountName()` |
| Master account name (Section 3) | `account_name` | [[../db/tables/project_accounts|project_accounts]] | LEFT JOIN ผ่าน `transactions.project_account_id` |
