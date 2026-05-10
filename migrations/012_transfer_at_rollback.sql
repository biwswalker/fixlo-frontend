-- Rollback for migration 012
-- Run this ONLY if 012_transfer_at_consolidation.sql was applied and must be reversed.
-- Requires a pre-migration backup or point-in-time restore — transfer_at cannot be
-- losslessly split back into transfer_date + transfer_time for rows where transfer_time was NULL.

ALTER TABLE transactions ADD COLUMN record_date  date;
ALTER TABLE transactions ADD COLUMN transfer_date date;
ALTER TABLE transactions ADD COLUMN transfer_time time;

UPDATE transactions
SET
  transfer_date = transfer_at::date,
  transfer_time = transfer_at::time,
  record_date   = transfer_at::date;

ALTER TABLE transactions DROP COLUMN transfer_at;
