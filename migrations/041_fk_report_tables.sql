-- Issue #103: FK migration for report tables.
-- 1. report_summary_daily.project_id: varchar → integer FK
-- 2. report_deposits, report_withdrawals, report_manual_credit_in,
--    report_manual_credit_out, report_manual_bonus_in, report_manual_bonus_out:
--    ADD project_id integer NOT NULL DEFAULT 1 REFERENCES projects(id)
--    (backfill existing rows to project_id=1, juno168)
-- Idempotent.

BEGIN;

-- ============================================================
-- report_summary_daily: varchar → integer FK
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_summary_daily' AND column_name = 'project_id'
      AND data_type IN ('character varying', 'text')
  ) THEN
    -- Pre-flight
    IF EXISTS (
      SELECT 1 FROM report_summary_daily rsd
      WHERE rsd.project_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.code = rsd.project_id)
    ) THEN
      RAISE EXCEPTION 'report_summary_daily has rows with project_id not matching any projects.code — cannot migrate';
    END IF;

    ALTER TABLE report_summary_daily ADD COLUMN project_id_new integer;

    UPDATE report_summary_daily rsd
    SET project_id_new = p.id
    FROM projects p
    WHERE p.code = rsd.project_id;

    -- Rows with NULL project_id default to project 1 (juno168)
    UPDATE report_summary_daily SET project_id_new = 1 WHERE project_id_new IS NULL;

    ALTER TABLE report_summary_daily DROP COLUMN project_id;
    ALTER TABLE report_summary_daily RENAME COLUMN project_id_new TO project_id;
    ALTER TABLE report_summary_daily ALTER COLUMN project_id SET NOT NULL;
    ALTER TABLE report_summary_daily ADD CONSTRAINT report_summary_daily_project_id_fk
      FOREIGN KEY (project_id) REFERENCES projects(id);
  END IF;
END $$;

-- ============================================================
-- Helper: add project_id to report_* tables that don't have it
-- ============================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'report_deposits',
    'report_withdrawals',
    'report_manual_credit_in',
    'report_manual_credit_out',
    'report_manual_bonus_in',
    'report_manual_bonus_out'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'project_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN project_id integer NOT NULL DEFAULT 1 REFERENCES projects(id)',
        tbl
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
