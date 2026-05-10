-- Migration 012: Consolidate record_date, transfer_date, transfer_time → transfer_at
-- Rollback: see 012_transfer_at_rollback.sql

ALTER TABLE transactions ADD COLUMN transfer_at timestamp;

UPDATE transactions
SET transfer_at = COALESCE(
  (transfer_date::timestamp + COALESCE(transfer_time::interval, '00:00'::interval)),
  record_date::timestamp,
  created_at
);

ALTER TABLE transactions DROP COLUMN record_date;
ALTER TABLE transactions DROP COLUMN transfer_date;
ALTER TABLE transactions DROP COLUMN transfer_time;
