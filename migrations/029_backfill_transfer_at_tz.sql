-- Migration 029: Backfill transfer_at offset error from Discord bot
--
-- Root cause: spectre worker ran in Asia/Bangkok TZ but treated new Date(localStr)
-- as UTC then subtracted 7h manually → transfer_at stored 7h too early.
--
-- Affected rows: transactions inserted via Discord bot (discord_message_id IS NOT NULL)
-- Safe guard: only rows where transfer_at IS NOT NULL
--
-- IMPORTANT: Run this ONLY after deploying the fixed worker (worker.js using +07:00 suffix).
-- Running while the old worker is active will not cover rows inserted after this point.

UPDATE transactions
SET transfer_at = transfer_at + INTERVAL '7 hours'
WHERE discord_message_id IS NOT NULL
  AND transfer_at IS NOT NULL;
