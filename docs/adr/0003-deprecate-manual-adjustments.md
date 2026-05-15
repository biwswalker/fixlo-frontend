---
id: "0003"
title: Deprecate manual_adjustments in favour of per-slip adjusted_amount
status: accepted
date: 2026-05-15
tags: [reconciliation, schema]
---

## Context

`manual_adjustments` เป็น free-form signed-amount entry ต่อ master account ใช้แก้ variance เมื่อ reconcile ไม่ตรง ไม่ผูกกับ slip ใดๆ โดยตรง

ปัญหาในทางปฏิบัติ:
- Admin สับสนระหว่าง "แก้ยอด AI ที่อ่านผิด" กับ "ปรับ variance ไม่ทราบสาเหตุ"
- ไม่มี audit trail ว่า slip ไหนมีปัญหา
- 0 rows ใน production — ยังไม่ถูกใช้จริงก่อนที่ feature นี้จะถูก formalize

## Decision

1. **Deprecate `manual_adjustments`** — ไม่สร้าง entry point ใหม่, ไม่นับใน formula
2. **เพิ่ม `adjusted_amount` บน `transactions`** — nullable numeric; admin override ยอด AI ที่อ่านผิดบน specific slip โดยไม่แก้ `ai_amount` เดิม (เพื่อ audit)
3. **เพิ่ม audit fields**: `adjusted_by` (text), `adjusted_at` (timestamptz), `adjust_note` (text nullable)
4. **Reconciliation formula ใหม่**: `effectiveOutflow = Σ COALESCE(adjusted_amount, ai_amount) + Σ manual_transactions.amount`
5. **กรณี variance ที่ไม่มี slip** → ให้ admin สร้าง Manual transaction แทน

## Alternatives considered

**คงไว้ทั้งคู่** — `adjusted_amount` per-slip + `manual_adjustments` free-form — ซับซ้อนเกินไป admin ต้องเลือกระหว่างสองทางทุกครั้ง และ formula มี 3 components

## Consequences

- Migration 022: `ALTER TABLE transactions ADD COLUMN adjusted_amount numeric, ADD COLUMN adjusted_by text, ADD COLUMN adjusted_at timestamptz, ADD COLUMN adjust_note text`
- `manual_adjustments` table ยังคงอยู่ใน DB (0 rows) — drop ได้ในอนาคตถ้าต้องการ
- Column "รายการปรับปรุง" ใน AccountBreakdownTable ถูกลบออก
- `addManualAdjustment` server action ยังคงอยู่ใน code แต่ไม่มี UI caller — สามารถ drop ได้ใน cleanup pass ถัดไป
