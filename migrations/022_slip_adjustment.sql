-- Migration 022: Add slip adjustment columns to transactions (issue #52)
-- Allows admins to correct AI-extracted amounts per slip with full audit trail.
-- adjusted_amount = NULL means not adjusted; reconciliation uses COALESCE(adjusted_amount, ai_amount).

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS adjusted_amount numeric,
  ADD COLUMN IF NOT EXISTS adjusted_by text,
  ADD COLUMN IF NOT EXISTS adjusted_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjust_note text;
