-- migration 057: CRM per-project LINE channel credentials
-- Stores each project's LINE Messaging API channel secret + access token in the DB
-- so n8n workflows read them via a Postgres node. Replaces the ADR 0007 env-var
-- strategy (LINE_CHANNEL_SECRET_<pid> / LINE_CHANNEL_TOKEN_<pid>): the n8n task-runner
-- blocks $env access in nodes (N8N_BLOCK_ENV_ACCESS_IN_NODE), so env vars are
-- unreachable from WF1 (signature verify + LINE profile) and WF4 (reply/push).
-- These are secrets — restrict DB grants and never log the columns. Rotating a
-- channel is now an UPDATE here, not a config/redeploy.

CREATE TABLE IF NOT EXISTS crm_line_channels (
    project_id     INTEGER PRIMARY KEY REFERENCES projects(id),
    channel_secret TEXT NOT NULL,
    channel_token  TEXT NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC'),
    updated_at     TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC')
);

-- Seed real values per project out-of-band (values not stored in the repo), e.g.:
--   INSERT INTO crm_line_channels (project_id, channel_secret, channel_token)
--   VALUES (1, '<line_channel_secret>', '<line_channel_access_token>')
--   ON CONFLICT (project_id) DO UPDATE
--     SET channel_secret = EXCLUDED.channel_secret,
--         channel_token  = EXCLUDED.channel_token,
--         updated_at     = (now() AT TIME ZONE 'UTC');
