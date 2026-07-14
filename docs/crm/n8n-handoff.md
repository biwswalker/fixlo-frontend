# Fixlo CRM — n8n hand-off spec

> Paste this into Claude cowork (with the n8n MCP against `n8n.fixlo.co`) to build the
> LINE service-desk pipeline. It is the **integration contract** between n8n and the Fixlo
> web app: a shared PostgreSQL schema + two webhooks. Design decisions live in
> [`CONTEXT.md`](CONTEXT.md) and [`adr/`](adr/) — read those first; this is the buildable
> spec.

## 0. Roles

- **n8n** owns the LINE channel: inbound webhook, debounce, embedding, KB search, Gemini,
  auto-reply/handoff, **and** outbound send. Writes PostgreSQL directly. Holds LINE
  secrets. ([ADR 0002](adr/0002-n8n-owns-line-ingestion.md))
- **Fixlo (Next.js)** reads the same DB, runs the inbox/KB/KPI UI, and POSTs admin replies
  + KB embed requests to n8n webhooks. Never calls LINE directly.
- Model: **service desk**, not sales. No orders/funnel/round-robin.
  ([ADR 0003](adr/0003-service-desk-reframe.md))

## 1. Database prerequisites

Run once on the canonical prod DB (endpoint intentionally not committed — see the private
agent memory `canonical_production_db` for host/port):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

CRM tables are **new**; they do not touch reconciliation tables. **Renaming a CRM column
is a breaking change for n8n** — coordinate migrations (lockstep discipline).

## 2. Schema (adapted from new-feature-07.md per the ADRs)

Changes vs the blueprint: `+project_id` everywhere; `admins` → `crm_agent_profile` keyed
to Fixlo identity; `customers` loses the sales funnel; `response_policy`/`is_sensitive` on
intents; explicit `crm_sessions` for FRT; `orders`/`promotions` **dropped** (deferred);
PII audit table added.

```sql
-- Agent = Fixlo identity × project (companion, not a new identity). ADR 0001.
CREATE TABLE crm_agent_profile (
    id            SERIAL PRIMARY KEY,
    fixlo_user_id TEXT NOT NULL,              -- external-auth user id (stable)
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    crm_role      VARCHAR(20) NOT NULL DEFAULT 'junior'
                  CHECK (crm_role IN ('junior','supervisor')),
    is_active     BOOLEAN DEFAULT TRUE,
    shift_start   TIME DEFAULT '08:00:00',
    shift_end     TIME DEFAULT '22:00:00',
    last_assigned_at TIMESTAMPTZ DEFAULT '1970-01-01 00:00:00Z',
    UNIQUE (fixlo_user_id, project_id)
);

-- Customer = LINE player (existing/VIP). ADR 0003. No funnel stage.
CREATE TABLE crm_customers (
    user_id       VARCHAR(50) NOT NULL,       -- LINE User ID (U...)
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    display_name  VARCHAR(100),
    phone_number  VARCHAR(20),                -- PII (masked at display). ADR 0004.
    bank_account  VARCHAR(60),                -- PII (masked). withdrawals need raw.
    tier          VARCHAR(20) DEFAULT 'Regular'
                  CHECK (tier IN ('Regular','VIP','VVIP')),
    assigned_admin_id INTEGER NULL REFERENCES crm_agent_profile(id), -- optional pin
    human_handoff BOOLEAN DEFAULT FALSE,
    custom_attributes JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC'),
    updated_at    TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC'),
    PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_crm_customers_tier ON crm_customers(project_id, tier);

-- Session = burst boundary for FRT. ADR 0003 (gap-based, default 6h).
CREATE TABLE crm_sessions (
    session_id    BIGSERIAL PRIMARY KEY,
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    user_id       VARCHAR(50) NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL,       -- first customer message of session
    first_customer_msg_at TIMESTAMPTZ NOT NULL,
    frt_start_at  TIMESTAMPTZ,                -- = handoff instant if AI replied first;
                                              --   else clamped to business hours. ADR 0003.
    first_admin_reply_at  TIMESTAMPTZ,
    first_responder_id    INTEGER NULL REFERENCES crm_agent_profile(id),
    frt_seconds   INTEGER,
    sla_passed    BOOLEAN,
    is_open       BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (project_id, user_id) REFERENCES crm_customers(project_id, user_id)
);
CREATE INDEX idx_crm_sessions_open ON crm_sessions(project_id, user_id) WHERE is_open;

-- Chat log.
CREATE TABLE crm_chat_messages (
    message_id    VARCHAR(100) PRIMARY KEY,   -- LINE message id (idempotency)
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    user_id       VARCHAR(50) NOT NULL,
    session_id    BIGINT REFERENCES crm_sessions(session_id),
    admin_id      INTEGER NULL REFERENCES crm_agent_profile(id),
    sender_type   VARCHAR(10) CHECK (sender_type IN ('customer','admin','bot')),
    message_text  TEXT NOT NULL,              -- password-redacted at ingestion. ADR 0004.
    reply_token   VARCHAR(100) NULL,          -- for 45s Reply-vs-Push routing
    reply_token_at TIMESTAMPTZ NULL,
    matched_intent_id INTEGER NULL,           -- if AI matched
    confidence    NUMERIC(4,3) NULL,
    is_draft      BOOLEAN DEFAULT FALSE,      -- copilot_suggest draft awaiting admin send
    created_at    TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC')
);
CREATE INDEX idx_crm_chat_session ON crm_chat_messages(session_id, created_at);
CREATE INDEX idx_crm_chat_cust ON crm_chat_messages(project_id, user_id, created_at DESC);

-- Knowledge base. ADR 0005: response_policy + is_sensitive.
CREATE TABLE crm_bot_knowledge_base (
    rule_id       SERIAL PRIMARY KEY,
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    intent_name   VARCHAR(100) NOT NULL,
    sample_utterances TEXT[] NOT NULL,
    embedding     vector(768),               -- text-embedding-004; n8n fills on approve
    target_response TEXT NOT NULL,
    response_type VARCHAR(20) CHECK (response_type IN ('direct_reply','llm_generate','human_handoff')),
    response_policy VARCHAR(20) NOT NULL DEFAULT 'copilot_suggest'
                  CHECK (response_policy IN ('autopilot','copilot_suggest','force_human')),
    is_sensitive  BOOLEAN DEFAULT FALSE,      -- deposit/withdrawal/complaint => locked human
    review_status VARCHAR(20) DEFAULT 'draft' -- mined draft -> approved. ADR 0005 §6.
                  CHECK (review_status IN ('draft','approved','archived')),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC')
);
-- IVFFlat/HNSW index after data is loaded, e.g.:
-- CREATE INDEX ON crm_bot_knowledge_base USING hnsw (embedding vector_cosine_ops);

-- Bot settings (global for phase 1; per-project deferred).
CREATE TABLE crm_bot_settings (
    setting_id    SERIAL PRIMARY KEY,
    system_prompt TEXT NOT NULL,
    temperature   NUMERIC(3,2) DEFAULT 0.20,
    confidence_threshold NUMERIC(3,2) DEFAULT 0.75,
    session_gap_minutes INTEGER DEFAULT 360,  -- 6h. ADR 0003.
    op_hours_start TIME DEFAULT '08:00:00',
    op_hours_end   TIME DEFAULT '22:00:00',
    sla_seconds   INTEGER DEFAULT 600
);

-- Optional VIP handoff audit. ADR 0003 (not primary flow).
CREATE TABLE crm_case_transfers (
    transfer_id   SERIAL PRIMARY KEY,
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    user_id       VARCHAR(50) NOT NULL,
    from_admin_id INTEGER REFERENCES crm_agent_profile(id),
    to_admin_id   INTEGER REFERENCES crm_agent_profile(id),
    reason        TEXT,
    transferred_at TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC')
);

-- PII unmask audit. ADR 0004.
CREATE TABLE crm_pii_access_log (
    log_id        BIGSERIAL PRIMARY KEY,
    fixlo_user_id TEXT NOT NULL,
    project_id    INTEGER NOT NULL,
    subject_user_id VARCHAR(50) NOT NULL,     -- whose PII
    field         VARCHAR(30) NOT NULL,       -- phone_number | bank_account | ...
    accessed_at   TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'UTC')
);

-- KPI read model. ADR 0003: FRT/SLA per agent per day. No sales/conversion.
CREATE MATERIALIZED VIEW crm_mv_agent_kpi_daily AS
SELECT
    s.project_id,
    (s.frt_start_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date AS work_date,
    a.fixlo_user_id,
    COUNT(*)                                        AS sessions_handled,
    COUNT(*) FILTER (WHERE s.frt_seconds IS NOT NULL) AS sessions_answered,
    ROUND(AVG(s.frt_seconds)::numeric, 2)           AS avg_frt_seconds,
    COUNT(*) FILTER (WHERE s.sla_passed)            AS sla_passed_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE s.sla_passed)
          / NULLIF(COUNT(*) FILTER (WHERE s.frt_seconds IS NOT NULL), 0), 2) AS sla_pass_pct
FROM crm_sessions s
JOIN crm_agent_profile a ON a.id = s.first_responder_id
GROUP BY s.project_id, work_date, a.fixlo_user_id;

CREATE UNIQUE INDEX idx_crm_mv_kpi ON crm_mv_agent_kpi_daily(project_id, work_date, fixlo_user_id);
```

**Timezone**: follow the repo invariant — `TIMESTAMPTZ` where possible; if a bare
`timestamp` is used, store **UTC** and filter Bangkok days with
`(col AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date` (see reconciliation
`CONTEXT.md` → *transfer_at timezone invariant*).

## 3. Workflows to build in n8n

### WF1 — Inbound webhook + debounce + sessionize

1. **LINE webhook** → verify signature.
2. **Upsert customer** (`crm_customers` by `(project_id, user_id)`; `project_id` from which
   OA/channel received it).
3. **Password redaction** (ADR 0004): regex `(รหัสผ่าน|password|รหัส)\s*[:：]?\s*\S+` →
   replace value with `[REDACTED]` before any storage.
4. **Debounce** 3–5s per `user_id`, concatenate; **drop noise** rows whose text is
   `คุณส่งรูป` / `คุณส่งสติกเกอร์` / empty.
5. **Sessionize**: if no open session or gap since last customer msg >
   `session_gap_minutes` → open a new `crm_sessions` (set `started_at`,
   `first_customer_msg_at`; compute `frt_start_at` with the operational-hours clamp).
6. **Insert** `crm_chat_messages` (`sender_type='customer'`, store `reply_token` +
   `reply_token_at`).
7. If `customer.human_handoff` → skip AI, notify inbox, done.

### WF2 — AI copilot (RAG + policy)

1. **Embed** the debounced text (`text-embedding-004`, 768d).
2. **KB search**: `SELECT ... 1-(embedding <=> $1) AS confidence FROM
   crm_bot_knowledge_base WHERE project_id=$p AND is_active AND review_status='approved'
   ORDER BY embedding <=> $1 LIMIT 1`.
3. **Decision order** (ADR 0005): confidence < threshold → handoff; else if
   `is_sensitive` → force_human; else if **sentiment=angry** (Gemini) → force_human; else
   branch on `response_policy`:
   - `autopilot` + `direct_reply` → send `target_response` (→ WF4 send), log `bot` msg.
   - `autopilot` + `llm_generate` → WF3 (Gemini) then send.
   - `copilot_suggest` → insert draft `crm_chat_messages` (`sender_type='bot'`,
     `is_draft=true`); notify inbox. **Do not send.**
   - `force_human` / handoff → set `human_handoff`, set session `frt_start_at = now()`
     (handoff instant), notify inbox.

### WF3 — Gemini generate (for `llm_generate`)

Use the blueprint's structured payload (Gemini Flash Lite, `temperature` from
`crm_bot_settings`, `response_schema {reply_text, need_human}`). System prompt =
`crm_bot_settings.system_prompt` + `[Knowledge Context]` = matched `target_response`.
**Fallback**: API error / rate-limit / `need_human=true` → send the holding message
*"ขออภัยในความล่าช้าค่ะ กำลังโอนสายให้แอดมินผู้เชี่ยวชาญดูแลต่อนะคะ"*, set handoff, start
FRT clock.

### WF4 — Outbound send (`crm-send` webhook)

Trigger = **Fixlo POST** `{project_id, user_id, admin_id, message_text}` (an admin sending,
or WF2 auto-send). Steps:
1. Look up the customer's latest `reply_token` + `reply_token_at`.
2. **Token routing**: age ≤ 45s → LINE **Reply** API (`/v2/bot/message/reply`, no quota);
   else → **Push** API (`/v2/bot/message/push`, metered).
3. **SLA update**: if this is the first admin reply of the open session → set
   `first_admin_reply_at`, `first_responder_id`, `frt_seconds = EXTRACT(EPOCH FROM
   (reply - frt_start_at))`, `sla_passed = frt_seconds <= sla_seconds`.
4. Insert `crm_chat_messages` (`sender_type='admin'`, `admin_id`); if it fulfilled a draft,
   clear `is_draft`.

### WF5 — KB embed (`crm-embed` webhook)

Trigger = **Fixlo POST** `{rule_id}` on intent approve/edit. Embed
`intent_name + sample_utterances`, `UPDATE crm_bot_knowledge_base SET embedding=$v` where
`rule_id`. Fixlo owns text+policy; n8n owns the vector.

### WF6 — KPI refresh (cron)

`REFRESH MATERIALIZED VIEW CONCURRENTLY crm_mv_agent_kpi_daily;` every 15 min.

## 4. KB mining (offline, one-off → human review)

Not an n8n webhook flow — a batch job (script or n8n manual workflow) over the LINE OA
export CSVs. ADR 0005.

- **Location**: store exports **outside the repo** at
  `~/workspaces/flexio/fixlo-crm-history/<project>/` (sibling of the repo, gitignored —
  the CSVs contain PII + plaintext passwords). The miner globs that directory.
- **Input**: `*.csv` LINE OA exports. Columns: `ประเภทผู้ส่ง` (`User`/`Account`),
  `ชื่อผู้ส่ง`, `วันส่ง`, `เวลาส่ง`, `ข้อความ`. Sender mapping: `User`→customer;
  `Account`+`ข้อความตอบกลับอัตโนมัติ`→bot; `Account`+nickname→admin.
- **Clean**: drop `คุณส่งรูป` / `คุณส่งสติกเกอร์` / auto-reply; **redact PII/passwords**
  before anything leaves the box.
- **Mine**: cluster customer messages by embedding; for each cluster take the recurring
  **admin canned reply** that follows as the candidate `target_response`, the customer
  messages as `sample_utterances`. Default money/complaint clusters to `is_sensitive=true`,
  `response_policy='force_human'`; safe clusters (ask-for-info, "รอสักครู่", deposit-
  account) to `copilot_suggest`.
- **Review**: write candidates as `crm_bot_knowledge_base` rows with
  `review_status='draft'`. A supervisor approves/edits in the Fixlo KB UI → status
  `approved` → Fixlo fires WF5 to embed. **Nothing goes live unreviewed.**
- Seed candidates visible in the sample export: "ขอเลขบัญชีฝาก" → deposit-account reply;
  "แจ้งชื่อ/เบอร์/บัญชี" (forgot-password / register) → the info-request canned text;
  "สอบถามถอน/ถอนช้า" → "รอทำรายการ" (sensitive → human).

## 5. Webhook contract summary

| Webhook (n8n) | Caller | Payload | Effect |
|---|---|---|---|
| `POST /webhook/crm-send` | Fixlo | `{project_id, user_id, admin_id, message_text}` | LINE send + SLA update + log admin msg |
| `POST /webhook/crm-embed` | Fixlo | `{rule_id}` | embed intent, write vector |
| LINE Messaging webhook | LINE | LINE event | WF1→WF2 pipeline |

Secrets (LINE channel token/secret, Gemini key, PG connection) live in **n8n
credentials**, not in Fixlo.
