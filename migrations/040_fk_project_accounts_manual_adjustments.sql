-- Issue #102: Convert project_accounts.project_id and manual_adjustments.project_id
-- from varchar (project code) to integer FK REFERENCES projects(id).
-- Pre-flight: RAISE EXCEPTION if any row references a code not in projects.code.
-- Idempotent — safe to re-run (checks column type before acting).

BEGIN;

-- ============================================================
-- project_accounts
-- ============================================================

-- Pre-flight: orphan check (accepts both code string e.g. 'juno168' AND integer string e.g. '1')
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM project_accounts pa
    WHERE NOT EXISTS (
      SELECT 1 FROM projects p
      WHERE p.code = pa.project_id OR p.id::text = pa.project_id
    )
  ) THEN
    RAISE EXCEPTION 'project_accounts has rows with project_id not matching any projects.code or id — cannot migrate';
  END IF;
END $$;

-- Add temporary integer column if not already integer FK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_accounts' AND column_name = 'project_id'
      AND data_type IN ('character varying', 'text')
  ) THEN
    ALTER TABLE project_accounts ADD COLUMN project_id_new integer;

    -- Resolve by code first, then by integer id string fallback
    UPDATE project_accounts pa
    SET project_id_new = COALESCE(
      (SELECT p.id FROM projects p WHERE p.code = pa.project_id),
      (SELECT p.id FROM projects p WHERE p.id::text = pa.project_id)
    );

    ALTER TABLE project_accounts DROP COLUMN project_id;
    ALTER TABLE project_accounts RENAME COLUMN project_id_new TO project_id;
    ALTER TABLE project_accounts ALTER COLUMN project_id SET NOT NULL;
    ALTER TABLE project_accounts ADD CONSTRAINT project_accounts_project_id_fk
      FOREIGN KEY (project_id) REFERENCES projects(id);
  END IF;
END $$;

-- ============================================================
-- manual_adjustments
-- ============================================================

-- Pre-flight: orphan check (skip if already integer)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manual_adjustments' AND column_name = 'project_id'
      AND data_type IN ('character varying', 'text')
  ) THEN
    IF EXISTS (
      SELECT 1 FROM manual_adjustments ma
      WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.code = ma.project_id)
    ) THEN
      RAISE EXCEPTION 'manual_adjustments has rows with project_id not matching any projects.code — cannot migrate';
    END IF;
  END IF;
END $$;

-- Convert manual_adjustments.project_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manual_adjustments' AND column_name = 'project_id'
      AND data_type IN ('character varying', 'text')
  ) THEN
    ALTER TABLE manual_adjustments ADD COLUMN project_id_new integer;

    UPDATE manual_adjustments ma
    SET project_id_new = p.id
    FROM projects p
    WHERE p.code = ma.project_id;

    ALTER TABLE manual_adjustments DROP COLUMN project_id;
    ALTER TABLE manual_adjustments RENAME COLUMN project_id_new TO project_id;
    ALTER TABLE manual_adjustments ALTER COLUMN project_id SET NOT NULL;
    ALTER TABLE manual_adjustments ADD CONSTRAINT manual_adjustments_project_id_fk
      FOREIGN KEY (project_id) REFERENCES projects(id);
  END IF;
END $$;

COMMIT;
