-- Issue #10: CHECK constraint on raw_uploads.ai_status
-- Pre-flight: verify all existing rows comply.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM raw_uploads
    WHERE ai_status NOT IN ('PENDING', 'PROCESSED', 'ERROR')
  ) THEN
    RAISE EXCEPTION 'Pre-flight failed: raw_uploads rows with unexpected ai_status values exist';
  END IF;
END $$;

-- Idempotent: skip if constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_raw_uploads_ai_status'
      AND conrelid = 'raw_uploads'::regclass
  ) THEN
    ALTER TABLE raw_uploads
      ADD CONSTRAINT chk_raw_uploads_ai_status
      CHECK (ai_status IN ('PENDING', 'PROCESSED', 'ERROR'));
  END IF;
END $$;
