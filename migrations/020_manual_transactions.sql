-- Migration 020: manual_transactions table (issue #49)
-- Stores withdrawals that were not captured via Discord slip pipeline.
-- These entries count directly as MANUAL_MAPPED outflow in reconciliation.

CREATE TABLE IF NOT EXISTS manual_transactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       integer     NOT NULL REFERENCES projects(id),
  project_account_id uuid      NOT NULL REFERENCES project_accounts(id),
  amount           numeric     NOT NULL,
  transfer_at      timestamptz NOT NULL,
  image_path       text,
  note             text,
  created_by       text        NOT NULL,
  created_at       timestamptz DEFAULT now()
);
