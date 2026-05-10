-- Issue #11: Add partial UNIQUE index on projects(discord_channel_id)
-- Pre-flight: confirm no duplicate non-NULL discord_channel_id values.
DO $$
BEGIN
  IF EXISTS (
    SELECT discord_channel_id
    FROM projects
    WHERE discord_channel_id IS NOT NULL
    GROUP BY discord_channel_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Pre-flight failed: duplicate discord_channel_id values exist among non-NULL rows';
  END IF;
END $$;

-- Idempotent: skip if index already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'projects'
      AND indexname = 'uq_projects_discord_channel_id'
  ) THEN
    CREATE UNIQUE INDEX uq_projects_discord_channel_id
      ON projects(discord_channel_id)
      WHERE discord_channel_id IS NOT NULL;
  END IF;
END $$;
