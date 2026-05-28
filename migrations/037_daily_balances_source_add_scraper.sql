-- Migration 037: Extend daily_balances source check constraint to include 'scraper'
-- Migration 030 added a partial unique index for source='scraper' rows but never
-- widened the CHECK constraint from migration 021, causing CheckViolation at insert.

ALTER TABLE daily_balances
  DROP CONSTRAINT IF EXISTS daily_balances_source_check;

ALTER TABLE daily_balances
  ADD CONSTRAINT daily_balances_source_check
    CHECK (source IN ('discord', 'manual', 'scraper'));
