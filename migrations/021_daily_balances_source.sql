-- Migration 021: Add source column to daily_balances (issue #50)
-- Distinguishes operator-uploaded snapshots ('discord') from admin-entered values ('manual').
-- Backfills all existing rows as 'discord'.

ALTER TABLE daily_balances
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'discord'
    CHECK (source IN ('discord', 'manual'));
