-- Issue #8: Drop transactions.is_time_anomaly dead column
-- UI references removed. No code ever sets this column.
-- Safe outside maintenance window.
ALTER TABLE transactions DROP COLUMN IF EXISTS is_time_anomaly;
