---
title: Fixlo CRM — Domain context
type: context
tags: [domain, glossary, crm]
---

# Fixlo CRM — Domain context

> LINE **service desk** for existing VIP players. Chat inbox + AI copilot (draft/auto by
> intent) + agent FRT/SLA KPI. Ingestion owned by n8n (`n8n.fixlo.co`); this app is the
> read/display + admin-action layer. Not a sales funnel — see
> [ADR 0003](adr/0003-service-desk-reframe.md).
>
> This is a **separate bounded context** from reconciliation. See root
> [[CONTEXT-MAP]]. "Customer" here = LINE player, **not** the reconciliation "project".

## Domain

Existing casino players (mostly VIP) chat a project's **LINE OA** for service: deposit
help, withdrawal status, credit disputes, forgot-password, promotions. n8n receives the
LINE webhook, debounces bursts, embeds the message, semantic-searches the knowledge base,
and either auto-replies, drafts a reply for an admin, or hands off to a human — per the
matched intent's policy. Admins work a **shared inbox** in this app; the AI assists.
Agent performance is measured by **first response time (FRT)** and SLA, since the real
customer pain is waiting ("นานจัง", "เป็นชั่วโมงแล้ว").

## Glossary

- **Customer** — a LINE end-user (an existing player, often VIP). PK = **LINE `user_id`**
  (`U...`). Scoped to a project. **Not** the reconciliation "project"/tenant. Owns
  `display_name`, `phone_number`, `bank_account` (PII — masked), `tier`. In phase 1 there
  is **no link** to `member_user` / `report_*` (game-side); deposit attribution deferred
  ([[ADR 0003]]).
- **Tier** — `customers.tier` VIP-status label (`Regular | VIP | VVIP`). From LINE OA
  segment / manual. Not a sales funnel stage — the doc's `Lead → Closed` funnel is
  **dropped** ([[ADR 0003]]).
- **Project (tenant)** — same `projects` row as reconciliation. Each project = one casino
  brand = **one LINE OA**. Every CRM table carries `project_id`. Inbox filters by the
  existing global project switcher.
- **crm_agent_profile** — companion row keyed by Fixlo user id **× project**. Holds
  CRM-only attributes: `crm_role` (`junior | supervisor`), `shift_start/end`,
  `last_assigned_at`. The Fixlo `owner|admin|staff|viewer` role governs reconciliation;
  `crm_role` governs CRM. **Two separate permission axes** ([[ADR 0001]]).
  - `junior` — handles inbox, sees **masked** PII.
  - `supervisor` — inbox + KB config + KPI + **full** PII (unmask audited).
- **Sender type** (`chat_messages.sender_type`) — `customer | admin | bot`. Mapping from
  the LINE OA export: `User` → customer; `Account` + name `ข้อความตอบกลับอัตโนมัติ` →
  bot (auto-reply); `Account` + a nickname → admin.
- **Admin nickname** — the display name an admin shows in LINE (`อุ๋มอิ๋ม🐱`, `BeeR`,
  `KID`, …). **Not stable**, emoji/unicode-styled. Mapping nickname → Fixlo user is
  best-effort; do not treat as a key.
- **Session** — a burst of one customer's messages; a new session starts when the gap
  since their previous message exceeds the **session gap** (default **6h**, configurable).
  Sessions bound FRT and group the inbox into per-case cards. A customer returns days
  later → new session. ([[ADR 0003]])
- **First response time (FRT)** — seconds from the **first customer message of a session**
  to the **first admin reply** in that session. Credited to the **first responder** (the
  admin who replies first), since the inbox is a shared pool ([[ADR 0003]]).
  - **AI-handoff rule** — if AI replied first then handed off, the admin's FRT clock
    starts at the **handoff instant**, not the customer's first message.
  - **Operational-hours rule** — FRT counts only within business hours (default
    08:00–22:00). A message outside hours has its start clamped to `08:00` of the next
    business day. Prevents penalising agents for 3am messages.
- **SLA pass** — a session whose FRT ≤ the SLA threshold (default 600s / 10 min).
- **Shared pool** — the inbox is a **team queue**; any on-shift agent may reply. There is
  no enforced 1-customer-per-agent ownership (the doc's round-robin is dropped). Optional
  nullable `assigned_admin_id` may pin a VIP to an agent for follow-up, non-blocking
  ([[ADR 0003]]).
- **Case transfer** — optional log (`case_transfers`) when a VIP is deliberately handed
  from agent A to B. Not the primary flow (pool is). Kept for audit/escalation.
- **Intent** — a `bot_knowledge_base` row: `intent_name`, `sample_utterances[]`,
  `embedding vector(768)`, `target_response`, `response_type`, **`response_policy`**,
  `is_sensitive`. Semantic search (cosine, pgvector) matches a debounced customer message
  to the nearest intent above the confidence threshold.
- **response_policy** — per-intent automation level, **configurable in Fixlo**
  ([[ADR 0005]]):
  - `autopilot` — n8n auto-sends `target_response` to the customer via LINE.
  - `copilot_suggest` — n8n drafts the reply into the inbox; an **admin sends** it.
  - `force_human` — no AI reply; straight to the inbox as a human task.
- **Sensitive intent** (`is_sensitive`) — deposit / withdrawal / complaint categories.
  **Locked to `force_human`** regardless of `response_policy` ([[ADR 0005]]).
- **Sentiment override** — if Gemini flags customer anger/frustration, the turn is forced
  to `force_human` even when the matched intent is `autopilot` ([[ADR 0005]]).
- **Human handoff** — a session's state where the AI has stepped back and it awaits a
  human (`customers.human_handoff` / session flag). Set by: low confidence,
  `force_human` intent, sensitive category, or sentiment override. n8n pushes a
  notification; FRT starts at the handoff instant.
- **Confidence threshold** (`bot_settings.confidence_threshold`, default 0.75) — cosine
  similarity below this → treat as no match → handoff.
- **Debounce** — n8n buffers a customer's consecutive messages for 3–5s and concatenates
  them into one paragraph before embedding, to cut redundant LLM calls. High-noise inputs
  (`คุณส่งรูป`, stickers) are filtered here.
- **Knowledge base (KB)** — the set of intents. Seeded by **mining the LINE OA chat
  history CSVs** offline (recurring canned admin replies → `target_response`; preceding
  customer messages → `sample_utterances`). Mined candidates go through a **human-in-loop
  review UI** in Fixlo before insert; embeddings are generated by n8n on approve
  ([[ADR 0005]]).
- **PII masking** — `phone_number`, `bank_account`, `address` are stored raw (service work
  needs them) but **display-masked by `crm_role`**: `junior` sees `081-XXX-XX89` / hidden
  account; `supervisor`+ see full. Every unmask writes an **audit log** (who/when/whose).
  ([[ADR 0004]])
- **Password redaction** — any password-like token in a message (`รหัสผ่าน` / `password`
  + value) is **redacted at ingestion for all roles** → stored/shown as `[REDACTED]`.
  Admins must never keep player passwords in chat — a process issue flagged to the
  business. ([[ADR 0004]])
- **Outbound send** — an admin reply does not call LINE directly. Fixlo `POST`s the intent
  (`user_id`, `admin_id`, `message_text`) to an **n8n webhook**; n8n does token-age
  routing (Reply ≤45s vs Push) and writes the `chat_messages` row. LINE secrets live only
  in n8n. ([[ADR 0002]])
- **mv_admin_kpi_daily** — materialized view (read model) aggregating per-agent daily
  FRT/SLA/reply counts. Refreshed by cron (`REFRESH ... CONCURRENTLY`). **Consumed by the
  Fixlo KPI page**, not Looker Studio (dropped — Looker cannot enforce PII masking / RBAC).
- **Order (deferred)** — a closed deposit amount attributable to an agent. **Not built in
  phase 1**; kept as an optional future metadata hook, not the core model ([[ADR 0003]]).

## Bounded contexts / integration

- **Ingestion + AI copilot** — owned by **n8n** (`n8n.fixlo.co`). LINE webhook → debounce
  → embed (Google `text-embedding-004`, 768d) → cosine search KB → decide per
  `response_policy` → auto-send / draft-to-inbox / handoff → write PostgreSQL directly.
  See [`n8n-handoff.md`](n8n-handoff.md). ([[ADR 0002]])
- **Read / display / admin actions** — this Next.js app: chat inbox, customer profiles,
  KB config + mining review, agent KPI, bot settings. Outbound replies POST to n8n.
- **Auth** — shared Fixlo identity; CRM authorization via `crm_agent_profile.crm_role`.

## Open questions / deferred

- **Order / deposit attribution** — link CRM outcomes to `report_*` / `member_user`.
  Deferred; needs a fresh grill (member code format is unstable — see reconciliation
  [[CONTEXT]] `amb_user`).
- **History → inbox** — importing old CSV history into the live inbox is blocked by
  phone≠LINE-userId; deferred to a lazy-match approach ([[ADR 0003]]).
- **Autopilot rollout** — phase 1 defaults most intents to `copilot_suggest`; widening
  `autopilot` coverage is a per-intent config decision made after observing draft quality.
- **Bot settings grain** — `system_prompt` / `temperature` currently global
  (`bot_settings`); per-project override is a future question.
