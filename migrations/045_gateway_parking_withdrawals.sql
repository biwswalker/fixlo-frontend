-- Migration 045: gateway_parking_withdrawals — capture-first parking sweeps
-- ADR 0017: per-transaction record of a gateway sweeping funds into a project's
-- master bank account ("parking"), scraped from the Apay merchant portal
-- "Merchant Withdrawal list". Capture-first — reconciliation integration deferred,
-- so this table is write-only for the scraper and read-only for analysis until a
-- later ADR carves parking out of the inflow formula.

CREATE TABLE IF NOT EXISTS gateway_parking_withdrawals (
  id               serial        PRIMARY KEY,
  project_id       integer       NOT NULL REFERENCES projects(id),
  order_id         text          NOT NULL,
  -- Destination master account, captured as raw text (ADR 0017 §4).
  -- project_account_id FK is intentionally deferred to the reconciliation phase.
  account_number   text,
  account_name     text,
  -- All four portal money figures captured (ADR 0017 §2). `amount` is the
  -- canonical net that lands in the master = request_amount - refund_amount.
  request_amount   numeric(15,2),
  refund_amount    numeric(15,2),
  amount           numeric(15,2),
  fee_amount       numeric(15,2),
  -- Portal row datetime, stored UTC-naive (transfer_at timezone invariant).
  transfer_at      timestamp,
  -- Raw portal status (Approved/Pending/...) — not normalised; status is mutable
  -- between scrapes so it is refreshed on conflict.
  status           text,
  scraped_at       timestamp,
  created_at       timestamp     NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  -- Idempotency key (ADR 0017 §3): one row per (project, order); ON CONFLICT
  -- DO UPDATE lets a re-scrape refresh status + amounts.
  CONSTRAINT gateway_parking_withdrawals_project_order_unique UNIQUE (project_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_gateway_parking_withdrawals_project_transfer_at
  ON gateway_parking_withdrawals (project_id, transfer_at);
