-- migration 052: CRM PII unmask audit log (issue #162)
-- Every "reveal full PII" action writes a row here (who/when/whose/field).
-- See docs/crm/adr/0004-pii-masking-and-password-redaction.md.

CREATE TABLE IF NOT EXISTS crm_pii_access_log (
    log_id          BIGSERIAL PRIMARY KEY,
    fixlo_user_id   TEXT NOT NULL,
    project_id      INTEGER NOT NULL REFERENCES projects(id),
    subject_user_id VARCHAR(50) NOT NULL,
    field           VARCHAR(30) NOT NULL,
    accessed_at     TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS idx_crm_pii_log_subject
    ON crm_pii_access_log(project_id, subject_user_id, accessed_at DESC);
