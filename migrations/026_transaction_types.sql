-- Migration 026: Transaction type lookup table (issue #74)
-- Admin-managed categories for slip classification (phase 1 = metadata only).
-- project_id = NULL means global (available to all projects).
CREATE TABLE IF NOT EXISTS transaction_types (
  id         serial PRIMARY KEY,
  project_id integer REFERENCES projects(id) ON DELETE CASCADE,
  name       text    NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_types_project_id ON transaction_types (project_id);
