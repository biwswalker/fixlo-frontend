-- Issue #9: Rename projects.project_name 'juno' -> 'juno168' (canonical)
-- juno168 is the canonical name used in report_summary_daily.project_id and scraper config.
-- Inactive projects (uno, gaza, yb) are left unchanged — TBD follow-up.
UPDATE projects SET project_name = 'juno168' WHERE project_name = 'juno' AND id = 1;
