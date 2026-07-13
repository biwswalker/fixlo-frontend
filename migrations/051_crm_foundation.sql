-- migration 051: CRM service desk — foundation tables (issue #156)
-- Second bounded context (docs/crm/). Ingestion owned by n8n; this repo reads.
-- Only the foundation subset here; KB (S6), bot_settings (S8), KPI mv (S7),
-- pii log (S3), case_transfers (S9) land with their own slices.
-- Timezone per the repo UTC invariant (see root CONTEXT.md).

CREATE EXTENSION IF NOT EXISTS vector;

-- Agent = Fixlo identity × project (companion, not a new identity). ADR 0001.
CREATE TABLE IF NOT EXISTS crm_agent_profile (
    id            SERIAL PRIMARY KEY,
    fixlo_user_id TEXT NOT NULL,
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    crm_role      VARCHAR(20) NOT NULL DEFAULT 'junior'
                  CHECK (crm_role IN ('junior','supervisor')),
    is_active     BOOLEAN DEFAULT TRUE,
    shift_start   TIME DEFAULT '08:00:00',
    shift_end     TIME DEFAULT '22:00:00',
    last_assigned_at TIMESTAMPTZ DEFAULT '1970-01-01 00:00:00Z',
    UNIQUE (fixlo_user_id, project_id)
);

-- Customer = LINE player (existing/VIP). ADR 0003. No sales funnel stage.
CREATE TABLE IF NOT EXISTS crm_customers (
    user_id       VARCHAR(50) NOT NULL,
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    display_name  VARCHAR(100),
    phone_number  VARCHAR(20),
    bank_account  VARCHAR(60),
    tier          VARCHAR(20) DEFAULT 'Regular'
                  CHECK (tier IN ('Regular','VIP','VVIP')),
    assigned_admin_id INTEGER NULL REFERENCES crm_agent_profile(id),
    human_handoff BOOLEAN DEFAULT FALSE,
    custom_attributes JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC'),
    updated_at    TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC'),
    PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_customers_tier ON crm_customers(project_id, tier);

-- Session = burst boundary for FRT (gap-based, default 6h). ADR 0003.
CREATE TABLE IF NOT EXISTS crm_sessions (
    session_id    BIGSERIAL PRIMARY KEY,
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    user_id       VARCHAR(50) NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL,
    first_customer_msg_at TIMESTAMPTZ NOT NULL,
    frt_start_at  TIMESTAMPTZ,
    first_admin_reply_at  TIMESTAMPTZ,
    first_responder_id    INTEGER NULL REFERENCES crm_agent_profile(id),
    frt_seconds   INTEGER,
    sla_passed    BOOLEAN,
    is_open       BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (project_id, user_id) REFERENCES crm_customers(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_sessions_open
    ON crm_sessions(project_id, user_id) WHERE is_open;
CREATE INDEX IF NOT EXISTS idx_crm_sessions_recent
    ON crm_sessions(project_id, started_at DESC);

-- Chat log. password-redacted at ingestion (ADR 0004).
CREATE TABLE IF NOT EXISTS crm_chat_messages (
    message_id    VARCHAR(100) PRIMARY KEY,
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    user_id       VARCHAR(50) NOT NULL,
    session_id    BIGINT REFERENCES crm_sessions(session_id),
    admin_id      INTEGER NULL REFERENCES crm_agent_profile(id),
    sender_type   VARCHAR(10) CHECK (sender_type IN ('customer','admin','bot')),
    message_text  TEXT NOT NULL,
    reply_token   VARCHAR(100) NULL,
    reply_token_at TIMESTAMPTZ NULL,
    matched_intent_id INTEGER NULL,
    confidence    NUMERIC(4,3) NULL,
    is_draft      BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS idx_crm_chat_session
    ON crm_chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_crm_chat_cust
    ON crm_chat_messages(project_id, user_id, created_at DESC);
