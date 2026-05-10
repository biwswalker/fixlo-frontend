-- Migration 016: Add match_breakdown to transactions
-- Stores top-3 candidate breakdown from smartMatcher so admin can see
-- why a transaction failed auto-match.
-- After running: trigger batchReRunSmartMatch from the UI to backfill existing rows.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS match_breakdown jsonb;
