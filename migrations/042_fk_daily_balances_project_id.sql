-- Issue #104: Replace daily_balances.project_name (text) with project_id integer FK.
-- Backfill strategy:
--   - Matched rows (project_account_id IS NOT NULL): derive via project_accounts.project_id (already integer after migration 040).
--   - Unmatched rows (project_account_id IS NULL): derive from project_name → projects.code match.
-- Pre-flight: fail if any unmatched row has a project_name with no matching projects.code.
-- Idempotent.

BEGIN;

DO $$
BEGIN
  -- Only run if project_name column still exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_balances' AND column_name = 'project_name'
  ) THEN
    RAISE NOTICE 'daily_balances.project_name already dropped — skipping';
    RETURN;
  END IF;

  -- Pre-flight: unmatched rows with unknown project_name
  IF EXISTS (
    SELECT 1 FROM daily_balances db
    WHERE db.project_account_id IS NULL
      AND db.project_name IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.code = db.project_name)
  ) THEN
    RAISE EXCEPTION 'daily_balances has unmatched rows with project_name not matching any projects.code — cannot migrate';
  END IF;

  -- Add project_id column (nullable for backfill)
  ALTER TABLE daily_balances ADD COLUMN IF NOT EXISTS project_id integer;

  -- Backfill matched rows via project_accounts (already integer FK after migration 040)
  UPDATE daily_balances db
  SET project_id = pa.project_id
  FROM project_accounts pa
  WHERE db.project_account_id = pa.id
    AND db.project_id IS NULL;

  -- Backfill unmatched rows via project_name → projects.code
  UPDATE daily_balances db
  SET project_id = p.id
  FROM projects p
  WHERE db.project_account_id IS NULL
    AND db.project_id IS NULL
    AND p.code = db.project_name;

  -- Pre-flight: verify no NULLs remain
  IF EXISTS (SELECT 1 FROM daily_balances WHERE project_id IS NULL) THEN
    RAISE EXCEPTION 'daily_balances.project_id backfill incomplete — rows with NULL project_id remain';
  END IF;

  -- Set NOT NULL + FK
  ALTER TABLE daily_balances ALTER COLUMN project_id SET NOT NULL;
  ALTER TABLE daily_balances ADD CONSTRAINT daily_balances_project_id_fk
    FOREIGN KEY (project_id) REFERENCES projects(id);

  -- Drop project_name
  ALTER TABLE daily_balances DROP COLUMN project_name;

END $$;

COMMIT;
