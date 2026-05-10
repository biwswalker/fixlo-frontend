-- Migration 014: Drop QR feature columns from transactions
-- These columns were populated by the jsQR path in fixlo-spectre which is being removed.
-- Rollback: re-add the four columns as nullable (no data recovery possible after apply).

ALTER TABLE transactions
  DROP COLUMN IF EXISTS qr_amount,
  DROP COLUMN IF EXISTS qr_code_text,
  DROP COLUMN IF EXISTS is_amount_mismatch,
  DROP COLUMN IF EXISTS is_amount_verified;
