-- Migration 023: Add alias provenance column to project_accounts (issue #69, ADR 0005)
-- aliases_meta is a write-side audit log of alias additions. The existing
-- `aliases` column remains the source of truth for the matcher hot path.
-- Backward-compatible: nullable, no backfill.

ALTER TABLE project_accounts
  ADD COLUMN IF NOT EXISTS aliases_meta jsonb;
