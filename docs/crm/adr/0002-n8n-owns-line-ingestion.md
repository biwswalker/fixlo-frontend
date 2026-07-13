---
id: "0002"
title: n8n owns LINE ingestion and outbound; Fixlo is the read/action layer
status: accepted
date: 2026-07-14
relates: ["crm 0001", "crm 0005 (per-intent AI policy)"]
tags: [crm, architecture, n8n, line, integration]
---

# ADR 0002 — n8n owns LINE ingestion + outbound

## Context

The CRM needs a LINE Messaging API pipeline: receive webhooks, debounce message bursts,
embed text, semantic-search a knowledge base, call Gemini, and reply. Fixlo's existing
pattern is "each external channel = its own service repo" (Discord bot `fixlo-spectre`,
scraper `fixlo-scraper`; the frontend only reads).

The team **already runs n8n** at `n8n.fixlo.co` and wants LINE handled there, writing to
PostgreSQL directly. The Next.js app is not a natural home for a stateful debounce buffer
and a long-running queue (serverless), and standing up a new bot repo like `fixlo-spectre`
is more infra to own.

## Decision

**n8n is the sole owner of the LINE channel.** Fixlo is a read/display + admin-action
layer over the same PostgreSQL.

1. **Inbound** — n8n workflows: LINE webhook → debounce (3–5s, concat, drop
   image/sticker noise) → embed (`text-embedding-004`, 768d) → cosine KB search → decide
   per intent `response_policy` (see [ADR 0005](0005-per-intent-ai-response-policy.md)) →
   auto-send / draft-to-inbox / handoff → **write PostgreSQL directly** (`customers`,
   `chat_messages`, session/FRT fields).

2. **Outbound** — an admin reply in the Fixlo inbox does **not** call LINE. Fixlo `POST`s
   `{project_id, user_id, admin_id, message_text}` to an **n8n webhook**
   (`n8n.fixlo.co/webhook/crm-send`). n8n does LINE **token-age routing** (Reply API if
   the latest reply-token is ≤45s old, else Push API) and writes the `admin` `chat_messages`
   row + SLA update. **LINE channel secrets live only in n8n** — never in the web app.

3. **KB embeddings** — when a supervisor approves/edits an intent in Fixlo, Fixlo `POST`s
   the text to an n8n webhook that generates the embedding and writes it back. Fixlo owns
   the intent **text + policy**; n8n owns the **vector**.

4. **Contract = the database + two webhooks.** The integration surface is the agreed
   PostgreSQL schema plus the `crm-send` and `crm-embed` webhooks. Documented for
   hand-off in [`../n8n-handoff.md`](../n8n-handoff.md).

## Consequences / risks

- **Single owner of LINE** (token routing, quota, secrets) → no split-brain between two
  services holding LINE credentials.
- n8n workflows are **harder to version-control / code-review** than a repo; mitigated by
  keeping the hand-off spec in-repo and treating the DB schema as the stable contract.
- n8n writing PostgreSQL directly means **the schema is a shared contract** — a migration
  that renames a CRM column breaks n8n silently. Coordinate CRM migrations with n8n
  updates (same discipline as the reconciliation lockstep migrations).
- Outbound latency now includes a Fixlo→n8n hop; acceptable, and it keeps the 45s
  reply-token logic in one place (a polling outbox would risk missing the window).
- If n8n later proves limiting, the contract (DB + webhooks) lets us swap it for a
  `fixlo-line` repo without touching Fixlo's read layer.

## Alternatives considered

- **New bot repo `fixlo-line`** (mirror `fixlo-spectre`) — rejected for phase 1: more
  infra to build/own when n8n already exists and fits.
- **Webhook + processing inside Next.js API routes** — rejected: stateful debounce +
  long-running queue is awkward on serverless; would need external Redis anyway.
- **Fixlo calls LINE API directly for outbound** — rejected: splits LINE secrets/token
  logic across two systems.
- **Outbox table polled by n8n** — rejected: the 45s reply-token window is latency-
  sensitive; polling risks falling back to (metered) Push.
