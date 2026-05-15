-- Migration 018: Add reject columns to transactions (issue #44)
-- Enables admin to reject slips with a reason. Rejected rows stay for audit trail
-- but are excluded from pending match list and reconciliation outflow (query already
-- filters AUTO_MAPPED / MANUAL_MAPPED only).

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS reject_reason  text,
  ADD COLUMN IF NOT EXISTS rejected_by    text,
  ADD COLUMN IF NOT EXISTS rejected_at    timestamptz;
