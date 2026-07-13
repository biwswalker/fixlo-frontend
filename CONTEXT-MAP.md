---
title: Fixlo CONTEXT MAP
type: context-map
tags: [domain, bounded-contexts]
---

# Fixlo — Context map

Fixlo has **two bounded contexts**. They share infrastructure (one Next.js app, one
PostgreSQL instance, one auth provider, the same `projects` tenant table) but have
**separate domain models, glossaries, and ADRs**. Do not fold one's vocabulary into the
other — "customer" means different things in each.

| Context | Lives in | What it is | Ingestion |
|---|---|---|---|
| **Reconciliation** (original) | [`CONTEXT.md`](CONTEXT.md) + [`docs/adr/`](docs/adr/) | Back-office iGaming money reconciliation — Discord slips → AI → match master accounts → กระทบยอด | Discord bot (`fixlo-spectre`), scraper (`fixlo-scraper`) |
| **CRM** (new) | [`docs/crm/CONTEXT.md`](docs/crm/CONTEXT.md) + [`docs/crm/adr/`](docs/crm/adr/) | LINE service desk for existing VIP players — chat inbox + AI copilot + agent FRT/SLA KPI | n8n (`n8n.fixlo.co`) → PostgreSQL |

## Shared kernel (both contexts depend on these)

- **`projects`** — the tenant table. Both contexts scope by `project_id`. A project is a
  casino brand (`juno168`, `uno168`, …). See reconciliation glossary for the canonical
  identifier rules ([ADR 0013](docs/adr/0013-project-canonical-identifier.md)).
- **Fixlo user / auth** — one identity from the external auth API. Reconciliation
  permissions use the `owner|admin|staff|viewer` role; CRM permissions use a **separate
  axis** (`crm_role`) stored per project in `crm_agent_profile`. The two axes do not mix.
  See [CRM ADR 0001](docs/crm/adr/0001-crm-bounded-context.md).
- **Gemini** — the same LLM provider both contexts use (slip OCR in reconciliation, chat
  copilot in CRM), but via different pipelines.

## What is NOT shared (deliberately)

- The CRM **customer** (a LINE end-user / player) is **not** the reconciliation
  **project** (a casino brand = Fixlo's tenant). Different concepts, different tables.
- CRM does **not** link to `member_user` / `report_*` in phase 1. Sales/deposit
  attribution back to the game-side data is deferred. See
  [CRM ADR 0003](docs/crm/adr/0003-service-desk-reframe.md).
