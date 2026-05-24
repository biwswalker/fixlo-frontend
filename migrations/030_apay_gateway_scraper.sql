-- Migration 030: Apay gateway scraper — new table and daily_balances idempotency
-- ADR 0009: scraper inserts balance into daily_balances (source='scraper') and
-- deposit/withdrawal aggregates into report_apay_daily.

-- 1. Partial unique constraint on daily_balances for scraper-inserted rows.
--    Allows ON CONFLICT (date, project_account_id) WHERE source='scraper' DO UPDATE
--    without touching existing discord/manual rows.
CREATE UNIQUE INDEX IF NOT EXISTS daily_balances_scraper_date_account_unique
  ON daily_balances (date, project_account_id)
  WHERE source = 'scraper';

-- 2. New table for Apay gateway daily deposit/withdrawal aggregates.
CREATE TABLE IF NOT EXISTS report_apay_daily (
  id                 serial        PRIMARY KEY,
  date               date          NOT NULL,
  project_account_id uuid          NOT NULL REFERENCES project_accounts(id),
  deposit_amount     numeric(15,2),
  withdrawal_amount  numeric(15,2),
  scraped_at         timestamp,
  created_at         timestamp     DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT report_apay_daily_date_account_unique UNIQUE (date, project_account_id)
);

CREATE INDEX IF NOT EXISTS idx_report_apay_daily_date
  ON report_apay_daily (date);

CREATE INDEX IF NOT EXISTS idx_report_apay_daily_project_account_id
  ON report_apay_daily (project_account_id);
