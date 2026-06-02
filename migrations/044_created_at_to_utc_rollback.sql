-- Rollback for migration 044: revert app-owned created_at UTC → Bangkok wall-clock.
-- Manual apply only. Run in the same no-trigger window, and redeploy fixlo-spectre
-- back to the AT-TIME-ZONE-'UTC' (no +7h) resolveBalanceDate alongside.
--
-- Guarded on default: only shifts back if the default is currently UTC.

BEGIN;

DO $$
DECLARE
  t text;
  app_tables text[] := ARRAY['raw_uploads','transactions','daily_balances','project_accounts','projects'];
  cur_default text;
BEGIN
  FOREACH t IN ARRAY app_tables LOOP
    SELECT column_default INTO cur_default
    FROM information_schema.columns
    WHERE table_name = t AND column_name = 'created_at';

    IF cur_default IS NULL OR cur_default !~* 'utc' THEN
      RAISE NOTICE '%.created_at not in UTC state — skipping rollback', t;
      CONTINUE;
    END IF;

    EXECUTE format('UPDATE %I SET created_at = created_at + interval ''7 hours'' WHERE created_at IS NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP', t);
    RAISE NOTICE '%.created_at rolled back UTC → Bangkok', t;
  END LOOP;
END $$;

COMMIT;
