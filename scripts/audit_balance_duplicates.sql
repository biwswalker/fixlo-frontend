-- Audit: find dates+accounts where both a discord row (balance_amount recoverable from
-- raw_ai_output) and a manual balance row coexist.
--
-- Run BEFORE applying migration 034 to plan dedup strategy.
-- Each result row = a potential conflict after backfill.
--
-- Columns:
--   date              — the overlapping date
--   account_name      — scanned account name on discord row
--   project_account_id — matched account (may be null if still UNMATCHED)
--   discord_id        — daily_balances.id for the discord row
--   discord_status    — matching_status of discord row
--   discord_ai_balance — balance from raw_ai_output (what 034 will restore)
--   manual_id         — daily_balances.id for the manual row
--   manual_balance    — balance_amount on manual row
--   manual_matched_by — who entered the manual balance

SELECT
  d.date,
  d.account_name,
  d.project_account_id,
  d.id                                          AS discord_id,
  d.matching_status                             AS discord_status,
  (d.raw_ai_output->>'balance_amount')::numeric AS discord_ai_balance,
  m.id                                          AS manual_id,
  m.balance_amount                              AS manual_balance,
  m.matched_by                                  AS manual_matched_by
FROM daily_balances d
JOIN daily_balances m
  ON  m.date                = d.date
  AND m.project_account_id  = d.project_account_id
  AND m.source              = 'manual'
WHERE d.source                             = 'discord'
  AND d.balance_amount                     IS NULL
  AND d.raw_ai_output->>'balance_amount'   IS NOT NULL
  AND d.project_account_id                 IS NOT NULL
ORDER BY d.date DESC, d.account_name;
