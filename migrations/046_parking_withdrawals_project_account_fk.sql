-- Migration 046: gateway_parking_withdrawals.project_account_id FK + backfill
-- ADR 0018 §2: attribute each parking sweep to the master account it landed in,
-- so reconciliation can carve it out of ยอดรับ. Nullable — parking does not always
-- hit a registered project_account (FK-null = harmless to the formula, display-only).

ALTER TABLE gateway_parking_withdrawals
  ADD COLUMN IF NOT EXISTS project_account_id uuid REFERENCES project_accounts(id);

-- Backfill: match the captured account_number against project_accounts within the
-- same project, comparing digits-only to absorb spacing/dash drift. Skip
-- soft-deleted master accounts. Rows with no match stay null.
UPDATE gateway_parking_withdrawals gpw
SET project_account_id = pa.id
FROM project_accounts pa
WHERE gpw.project_account_id IS NULL
  AND pa.project_id = gpw.project_id
  AND pa.deleted_at IS NULL
  AND regexp_replace(COALESCE(pa.account_number, ''), '[^0-9]', '', 'g')
      = regexp_replace(COALESCE(gpw.account_number, ''), '[^0-9]', '', 'g')
  AND regexp_replace(COALESCE(gpw.account_number, ''), '[^0-9]', '', 'g') <> '';

CREATE INDEX IF NOT EXISTS idx_gateway_parking_withdrawals_account_transfer_at
  ON gateway_parking_withdrawals (project_account_id, transfer_at);
