-- Migration 038: Backfill transactions.transfer_at for rows where it is NULL
--
-- Root cause: spectre worker leaves transfer_at NULL when both targetDate (from
-- Discord upload) and aiOutput.date (AI-extracted) are unavailable at processing time.
--
-- Strategy: join transactions → raw_uploads via image_path (1:1) and compute
-- transfer_at from target_date + raw_ai_output.time using Bangkok → UTC, mirroring
-- backfill-transfer-at.js and the worker's own convention (ADR-0010).
--
-- Only touches rows where transfer_at IS NULL and a matching raw_uploads row with
-- a non-null target_date exists. Rows with no raw_upload match are left unchanged
-- (manual-entry slips created via saveTransactionOcrResult already have transfer_at set).
--
-- Safe to re-run: IS NULL guard prevents double-processing.

-- Pass 1: target_date available → accurate Bangkok time reconstruction
UPDATE transactions t
SET transfer_at = (
  (r.target_date::text || ' ' || COALESCE(NULLIF(t.raw_ai_output->>'time', ''), '00:00') || ':00')
    ::timestamp AT TIME ZONE 'Asia/Bangkok' AT TIME ZONE 'UTC'
)
FROM raw_uploads r
WHERE r.image_path = t.image_path
  AND t.transfer_at IS NULL
  AND r.target_date IS NOT NULL;

-- Pass 2: target_date also NULL → fall back to upload created_at (best available approximation)
-- Covers slips where sourceProject could not be resolved at bot time (active_date unavailable).
UPDATE transactions t
SET transfer_at = r.created_at
FROM raw_uploads r
WHERE r.image_path = t.image_path
  AND t.transfer_at IS NULL
  AND r.target_date IS NULL
  AND r.created_at IS NOT NULL;
