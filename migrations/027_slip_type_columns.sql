-- Migration 027: Add transaction type FK and sub-type to slip tables (issue #76)
-- Phase 1: metadata only — no calculation impact.
-- transaction_type_id references transaction_types(id); ON DELETE SET NULL so
-- deleting a type does not cascade-delete slips (application layer blocks deletes
-- when slips reference a type).
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS transaction_type_id integer REFERENCES transaction_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transaction_subtype  text;

ALTER TABLE manual_transactions
  ADD COLUMN IF NOT EXISTS transaction_type_id integer REFERENCES transaction_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transaction_subtype  text;
