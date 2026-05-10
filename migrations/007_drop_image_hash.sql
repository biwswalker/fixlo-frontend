-- Issue #7: Drop transactions.image_hash dead column
-- Safe outside maintenance window — no code reads or writes this column.
ALTER TABLE transactions DROP COLUMN IF EXISTS image_hash;
