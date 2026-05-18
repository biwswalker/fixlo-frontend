-- Migration 024: Add account_number column to daily_balances (balance matcher v2, ADR 0005)
-- Stores visible/masked account numbers from balance screenshots (e.g., "06*-***-7141").
-- Used by matcher v2 as priority source alongside platform. Nullable; only BALANCE type images.

ALTER TABLE daily_balances
  ADD COLUMN IF NOT EXISTS account_number text;
