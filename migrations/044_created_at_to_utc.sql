-- Migration 044: standardize app-owned created_at to UTC (issue: created_at TZ convention)
--
-- Problem: app-owned `created_at` columns are `timestamp without time zone` but
-- store **Bangkok wall-clock** (DEFAULT CURRENT_TIMESTAMP + DB session TZ = Asia/Bangkok),
-- while `transfer_at` stores **UTC**. Same type, 7h apart — a silent trap.
-- See CONTEXT.md "created_at timezone caveat" and ADR 0015.
--
-- Fix: shift existing rows Bangkok → UTC (−7h, Thailand has no DST) and change the
-- column DEFAULT to store UTC going forward, matching the transfer_at convention.
--
-- SCOPE (app-owned only — written by fixlo / fixlo-spectre):
--   raw_uploads, transactions, daily_balances, project_accounts, projects
-- EXCLUDED:
--   report_* (written by fixlo-scraper, repo 3 — separate convention, not migrated)
--   manual_transactions, transaction_types (already `timestamptz` — correct)
--   manual_adjustments (deprecated, 0 rows)
--
-- ⚠️ DEPLOY ORDER (see issue runbook): apply this during a no-trigger window and
-- redeploy fixlo-spectre with the +7h resolveBalanceDate in the same window.
-- Between backfill and redeploy, balance dating is incorrect.
--
-- Idempotency: guarded on the column DEFAULT. Once the default is UTC the backfill
-- is skipped, so re-running is a no-op (prevents a double −7h shift).

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

    IF cur_default IS NULL THEN
      RAISE NOTICE '%.created_at has no default — skipping (verify manually)', t;
      CONTINUE;
    END IF;

    -- Already migrated? (default no longer the Bangkok CURRENT_TIMESTAMP)
    IF cur_default !~* 'current_timestamp|now\(\)' OR cur_default ~* 'utc' THEN
      RAISE NOTICE '%.created_at already UTC (default=%) — skipping', t, cur_default;
      CONTINUE;
    END IF;

    -- Backfill existing Bangkok-naive values → UTC-naive
    EXECUTE format('UPDATE %I SET created_at = created_at - interval ''7 hours'' WHERE created_at IS NOT NULL', t);

    -- New rows store UTC-naive (matches transfer_at convention)
    EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE ''UTC'')', t);

    RAISE NOTICE '%.created_at migrated Bangkok → UTC', t;
  END LOOP;
END $$;

COMMIT;
