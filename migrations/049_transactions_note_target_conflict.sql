-- migration 049: note-derived target project + conflict flag (ADR 0019 #130)
-- note_target_project_id: project matched from slip_note suffix (worker-set)
-- target_conflict: true when caption target ≠ note target (both non-null, different)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS note_target_project_id integer REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_conflict boolean NOT NULL DEFAULT false;
