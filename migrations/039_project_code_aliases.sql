-- Issue #99: Add projects.code (natural key) + aliases (Discord/URL slug array)
-- + CHECK invariant: ACTIVE requires discord_channel_id + active_date.
-- Idempotent — safe to re-run.

BEGIN;

-- 1. Add aliases column (idempotent)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

-- 2. Add code column as nullable first (backfill, then tighten)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS code text;

-- 3. Rename juno → juno168 (project_name) if still old value
UPDATE projects SET project_name = 'juno168' WHERE id = 1 AND project_name = 'juno';

-- 4. Backfill code + aliases for the 4 known projects (idempotent via ON CONFLICT DO NOTHING skip — use UPDATE instead)
UPDATE projects SET code = 'juno168', aliases = ARRAY['juno','jn']  WHERE id = 1 AND code IS NULL;
UPDATE projects SET code = 'uno168',  aliases = ARRAY['uno']        WHERE id = 2 AND code IS NULL;
UPDATE projects SET code = 'gaza168', aliases = ARRAY['gaza']       WHERE id = 3 AND code IS NULL;
UPDATE projects SET code = 'yb168',   aliases = ARRAY['yb']         WHERE id = 4 AND code IS NULL;

-- 5. Pre-flight: fail loud if any row still has NULL code
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM projects WHERE code IS NULL) THEN
    RAISE EXCEPTION 'projects.code backfill incomplete — rows with NULL code remain';
  END IF;
END $$;

-- 6. Add UNIQUE constraint on code (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_code_key'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_code_key UNIQUE (code);
  END IF;
END $$;

-- 7. Set NOT NULL now that backfill is verified
ALTER TABLE projects ALTER COLUMN code SET NOT NULL;

-- 8. Add ACTIVE invariant CHECK (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_active_requires_channel_and_date'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_active_requires_channel_and_date
      CHECK (status != 'ACTIVE' OR (discord_channel_id IS NOT NULL AND active_date IS NOT NULL));
  END IF;
END $$;

COMMIT;
