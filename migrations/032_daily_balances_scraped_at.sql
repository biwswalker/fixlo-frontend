-- Migration 032: Add scraped_at to daily_balances
-- Tracks when the scraper fetched the data (vs created_at = row insert time).
-- Used by source='scraper' rows from apay_scraper.py.

ALTER TABLE daily_balances
  ADD COLUMN IF NOT EXISTS scraped_at timestamp;
