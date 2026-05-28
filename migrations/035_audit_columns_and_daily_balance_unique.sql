-- Migration 035: audit columns + daily_balances UNIQUE constraint (issues #89, #90)
--
-- Adds last_edited_* and deleted_* audit columns to manual_transactions and daily_balances.
-- On transactions, only last_edited_* (no delete — Discord slips are non-deletable per ADR 0011).
-- Adds partial UNIQUE index on daily_balances (date, project_account_id) for matched rows.

-- transactions: edit-audit only (REJECT is the delete path per ADR 0007 / ADR 0011)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS last_edited_by   text,
  ADD COLUMN IF NOT EXISTS last_edited_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_edited_note text;

-- manual_transactions: full edit + delete audit
ALTER TABLE manual_transactions
  ADD COLUMN IF NOT EXISTS last_edited_by   text,
  ADD COLUMN IF NOT EXISTS last_edited_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_edited_note text,
  ADD COLUMN IF NOT EXISTS deleted_at       timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by       text,
  ADD COLUMN IF NOT EXISTS delete_reason    text;

-- daily_balances: full edit + delete audit
ALTER TABLE daily_balances
  ADD COLUMN IF NOT EXISTS last_edited_by   text,
  ADD COLUMN IF NOT EXISTS last_edited_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_edited_note text,
  ADD COLUMN IF NOT EXISTS deleted_at       timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by       text,
  ADD COLUMN IF NOT EXISTS delete_reason    text;

-- One balance per (account, date) for matched rows. UNMATCHED rows (project_account_id IS NULL) are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS daily_balances_account_date_unique
  ON daily_balances (date, project_account_id)
  WHERE project_account_id IS NOT NULL;

-- Down: drop added columns and index
-- ALTER TABLE transactions DROP COLUMN IF EXISTS last_edited_by, DROP COLUMN IF EXISTS last_edited_at, DROP COLUMN IF EXISTS last_edited_note;
-- ALTER TABLE manual_transactions DROP COLUMN IF EXISTS last_edited_by, DROP COLUMN IF EXISTS last_edited_at, DROP COLUMN IF EXISTS last_edited_note, DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS delete_reason;
-- ALTER TABLE daily_balances DROP COLUMN IF EXISTS last_edited_by, DROP COLUMN IF EXISTS last_edited_at, DROP COLUMN IF EXISTS last_edited_note, DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS delete_reason;
-- DROP INDEX IF EXISTS daily_balances_account_date_unique;
