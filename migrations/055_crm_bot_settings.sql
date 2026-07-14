-- migration 055: CRM bot settings (issue #161)
-- Global copilot + KPI parameters, read by the CRM logic and by n8n.
-- See docs/crm/adr/0003 and 0005. Single row (setting_id = 1) seeded with defaults.

CREATE TABLE IF NOT EXISTS crm_bot_settings (
    setting_id    SERIAL PRIMARY KEY,
    system_prompt TEXT NOT NULL DEFAULT '',
    temperature   NUMERIC(3,2) DEFAULT 0.20,
    confidence_threshold NUMERIC(3,2) DEFAULT 0.75,
    session_gap_minutes INTEGER DEFAULT 360,
    op_hours_start TIME DEFAULT '08:00:00',
    op_hours_end   TIME DEFAULT '22:00:00',
    sla_seconds   INTEGER DEFAULT 600
);

INSERT INTO crm_bot_settings (setting_id, system_prompt)
VALUES (1, 'คุณคือผู้ช่วยแอดมินตอบแชทของบริษัท')
ON CONFLICT (setting_id) DO NOTHING;
