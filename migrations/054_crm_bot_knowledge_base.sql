-- migration 054: CRM knowledge base (issue #160)
-- Intents for the AI copilot. Fixlo owns text + policy; n8n owns the vector.
-- See docs/crm/adr/0005-per-intent-ai-response-policy.md.

CREATE TABLE IF NOT EXISTS crm_bot_knowledge_base (
    rule_id       SERIAL PRIMARY KEY,
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    intent_name   VARCHAR(100) NOT NULL,
    sample_utterances TEXT[] NOT NULL DEFAULT '{}',
    embedding     vector(768),
    target_response TEXT NOT NULL,
    response_type VARCHAR(20)
                  CHECK (response_type IN ('direct_reply','llm_generate','human_handoff')),
    response_policy VARCHAR(20) NOT NULL DEFAULT 'copilot_suggest'
                  CHECK (response_policy IN ('autopilot','copilot_suggest','force_human')),
    is_sensitive  BOOLEAN DEFAULT FALSE,
    review_status VARCHAR(20) DEFAULT 'draft'
                  CHECK (review_status IN ('draft','approved','archived')),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS idx_crm_kb_project
    ON crm_bot_knowledge_base(project_id, review_status);
