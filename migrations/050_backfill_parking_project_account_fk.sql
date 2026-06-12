-- migration 050: backfill gateway_parking_withdrawals.project_account_id (2-tier match)
-- Migration 046 ran once at apply time; rows scraped after that date stayed NULL.
-- Tier 1: digits-only account_number match (fast, precise).
-- Tier 2: exact account_name fallback (for rows where portal omits/masks number).
-- Scoped to the same project_id so cross-project accounts never collide.
UPDATE gateway_parking_withdrawals gpw
SET project_account_id = pa.id
FROM project_accounts pa
WHERE gpw.project_account_id IS NULL
  AND pa.project_id = gpw.project_id
  AND pa.deleted_at IS NULL
  AND (
    (
      regexp_replace(COALESCE(pa.account_number, ''), '[^0-9]', '', 'g')
        = regexp_replace(COALESCE(gpw.account_number, ''), '[^0-9]', '', 'g')
      AND regexp_replace(COALESCE(gpw.account_number, ''), '[^0-9]', '', 'g') <> ''
    )
    OR (
      gpw.account_name IS NOT NULL AND gpw.account_name <> ''
      AND gpw.account_name = pa.account_name
    )
  );
