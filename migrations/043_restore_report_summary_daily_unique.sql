-- Migration 043: Restore unique constraint on report_summary_daily(report_date, project_id).
-- Migration 015 created uq_report_summary_daily_date_project, but migration 041 dropped
-- the project_id varchar column (CASCADE) which silently dropped the constraint too.
-- After migration 041 renames project_id_new → project_id, the constraint is not recreated.
-- Idempotent.

ALTER TABLE report_summary_daily
  DROP CONSTRAINT IF EXISTS uq_report_summary_daily_date_project;

ALTER TABLE report_summary_daily
  ADD CONSTRAINT uq_report_summary_daily_date_project
    UNIQUE (report_date, project_id);
