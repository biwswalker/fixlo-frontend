-- Migration 019: Soft-delete support for project_accounts (issue #45)
-- Accounts with deleted_at set are hidden from all dropdowns and match/reconciliation queries.

ALTER TABLE project_accounts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
