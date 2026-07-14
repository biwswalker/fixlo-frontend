-- migration 056: CRM case transfers (issue #163)
-- Optional audit log for deliberate VIP handoffs between agents. The inbox stays
-- a shared pool; assigned_admin_id (crm_customers, migration 051) is a non-binding
-- pin. See docs/crm/adr/0003-service-desk-reframe.md.

CREATE TABLE IF NOT EXISTS crm_case_transfers (
    transfer_id   SERIAL PRIMARY KEY,
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    user_id       VARCHAR(50) NOT NULL,
    from_admin_id INTEGER REFERENCES crm_agent_profile(id),
    to_admin_id   INTEGER REFERENCES crm_agent_profile(id),
    reason        TEXT,
    transferred_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS idx_crm_case_transfers_cust
    ON crm_case_transfers(project_id, user_id, transferred_at DESC);
