-- Migration 013: Drop legacy users table and user_role enum
-- Pre-flight: confirm no FROM/JOIN users exists in application queries (grep passed)
-- Rollback: see 013_drop_users_rollback.sql

-- Step 1: change created_by from UUID/user_role to plain text
ALTER TABLE manual_adjustments
  ALTER COLUMN created_by TYPE text USING created_by::text;

-- Step 2: drop the users table (keep a backup snapshot first if audit needed)
-- CREATE TABLE users_backup AS SELECT * FROM users;
DROP TABLE IF EXISTS users;

-- Step 3: drop the enum (only safe after the table is gone)
DROP TYPE IF EXISTS user_role;
