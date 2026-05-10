-- Migration 017: Extend daily_balances for account matching pipeline
-- Mirrors the matching columns on transactions (project_account_id, matching_status, match_breakdown)
-- plus matched_by for manual-match audit trail and a dedup constraint.

ALTER TABLE daily_balances
  ADD COLUMN IF NOT EXISTS project_account_id uuid
    REFERENCES project_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matching_status text NOT NULL DEFAULT 'UNMATCHED',
  ADD COLUMN IF NOT EXISTS matched_by text,
  ADD COLUMN IF NOT EXISTS match_breakdown jsonb;

-- Dedupe on (date, discord_message_id) before adding unique constraint.
-- Keeps the highest id (latest inserted) per pair, matching migration 015 pattern.
DELETE FROM daily_balances
WHERE id NOT IN (
  SELECT DISTINCT ON (date, discord_message_id) id
  FROM daily_balances
  WHERE discord_message_id IS NOT NULL
  ORDER BY date, discord_message_id, id DESC
);

ALTER TABLE daily_balances
  DROP CONSTRAINT IF EXISTS daily_balances_date_discord_message_id_key;

ALTER TABLE daily_balances
  ADD CONSTRAINT daily_balances_date_discord_message_id_key
    UNIQUE (date, discord_message_id);
