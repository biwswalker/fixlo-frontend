-- migration 047: add slip_note to transactions
-- OCR'd bank memo from the slip image (any field label: บันทึก/โน๊ต/หมายเหตุ/etc.)
-- Nullable: slips without a readable memo leave this null.
-- Populated by spectre worker (ADR 0019 phase 1 — capture + display only).
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS slip_note text;
