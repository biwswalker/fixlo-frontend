-- Migration 031: Add fee_amount column to report_apay_daily
-- Apay portal reports Fee alongside Deposit/Withdrawal in Payment Summary.

ALTER TABLE report_apay_daily
  ADD COLUMN IF NOT EXISTS fee_amount numeric(15,2);
