-- Rollback for migration 013
-- Requires the users_backup table created before DROP (see comment in 013_drop_users_table.sql).

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'staff', 'viewer');

CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username   text NOT NULL UNIQUE,
  role       user_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Restore from backup if it was created before the DROP:
-- INSERT INTO users SELECT * FROM users_backup;

-- Revert created_by back to UUID (data loss warning: text values that are not valid UUIDs will fail)
ALTER TABLE manual_adjustments
  ALTER COLUMN created_by TYPE uuid USING created_by::uuid;
