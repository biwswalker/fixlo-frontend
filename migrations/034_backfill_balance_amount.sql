-- Migration 034: Backfill balance_amount on discord daily_balances rows where AI stored
-- the value in raw_ai_output.balance_amount but worker.js mapped aiOutput.amount instead
-- (which is null for GATEWAY_BALANCE type images like Apay, Wealth.wave, Badoo).
--
-- Safe to run multiple times (WHERE clause only targets null rows that have the value in JSON).
-- Does NOT change matching_status — rows stay UNMATCHED/PENDING_REVIEW so reconciliation
-- queries (which filter AUTO_MAPPED/MANUAL_MAPPED) are unaffected until admin explicitly maps them.

UPDATE daily_balances
SET balance_amount = (raw_ai_output->>'balance_amount')::numeric
WHERE source = 'discord'
  AND balance_amount IS NULL
  AND raw_ai_output->>'balance_amount' IS NOT NULL
  AND (raw_ai_output->>'balance_amount')::text ~ '^[0-9]+(\.[0-9]+)?$';
