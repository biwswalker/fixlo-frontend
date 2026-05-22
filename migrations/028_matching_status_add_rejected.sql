-- Migration 028: Extend chk_matching_status to include REJECTED (issue #75)
-- Migration 018 added reject columns but never updated the CHECK constraint,
-- so any attempt to set matching_status = 'REJECTED' threw a 23514 violation.
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_matching_status;

ALTER TABLE transactions
  ADD CONSTRAINT chk_matching_status
    CHECK (matching_status IN (
      'AUTO_MAPPED',
      'PENDING_REVIEW',
      'MANUAL_MAPPED',
      'UNMAPPED',
      'REJECTED'
    ));
