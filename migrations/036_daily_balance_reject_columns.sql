-- Migration 036: Add reject audit columns to daily_balances (issue #94 — reject daily balance)
ALTER TABLE daily_balances
  ADD COLUMN IF NOT EXISTS reject_reason  text,
  ADD COLUMN IF NOT EXISTS rejected_by    text,
  ADD COLUMN IF NOT EXISTS rejected_at    timestamptz;

-- Down: DROP COLUMN IF EXISTS reject_reason, rejected_by, rejected_at
