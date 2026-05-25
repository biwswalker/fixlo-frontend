-- Migration 033: Add source column to report_apay_daily
-- Allows scraper rows and discord fallback rows to coexist for the same date.
-- Replaces UNIQUE(date, project_account_id) with UNIQUE(date, project_account_id, source).

ALTER TABLE report_apay_daily
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'scraper';

ALTER TABLE report_apay_daily
  DROP CONSTRAINT IF EXISTS report_apay_daily_date_account_unique;

ALTER TABLE report_apay_daily
  ADD CONSTRAINT report_apay_daily_date_account_source_unique
    UNIQUE (date, project_account_id, source);
