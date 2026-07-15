---
id: "0007"
title: Runtime pipeline hardening — multi-tenant LINE auth, signature enforcement, SLA fix, no realtime v1
status: accepted
date: 2026-07-14
relates: ["crm 0002 (n8n owns LINE ingestion)", "crm 0001 (multi-tenant)"]
tags: [crm, n8n, security, rbac, kpi]
---

# ADR 0007 — Runtime pipeline hardening

## Context

WF1–WF6 (n8n, `n8n.fixlo.co`) were built per [`n8n-handoff.md`](../n8n-handoff.md) and
match the domain rules closely — session gap + business-hour clamp, the AI-handoff
`frt_start_at` reset, and the confidence → sensitivity → sentiment → policy decision
order are all implemented correctly. All 6 workflows exist but are **inactive** with
**zero credentials configured**. Inspecting the built workflows (not the spec) surfaced
three real gaps before they can go live for the project's 4 tenants (juno168, uno68,
gaza, yb):

1. LINE Reply/Push/Profile calls use a single shared n8n credential — works for one LINE
   OA, breaks for 4 (ADR 0001's multi-tenant requirement).
2. The LINE webhook computes `signatureValid` but nothing rejects on failure — any POST
   to the (guessable, per-project) webhook path can inject fake customer messages.
3. WF4's "first admin reply" check tests `admin_id exists`, but `admin_id` is `null`
   (not absent) on an autopilot/bot send — if `exists()` treats a present-but-null key as
   true, an autopilot send would falsely close the session's FRT clock with no responder.

A fourth question was raised: `pg_notify('crm_inbox_events', …)` is emitted from WF1/WF2
but Fixlo has no listener, so the inbox doesn't update live.

## Decision

### 1. LINE auth stays env-var-per-project, not n8n Credential objects

Extend the existing pattern (`LINE_CHANNEL_SECRET_<projectId>`, already used for
signature verification) to the channel access token: `LINE_CHANNEL_TOKEN_<projectId>`.
Every node that calls the LINE API (Reply, Push, Profile) drops
`authentication: genericCredentialType/httpBearerAuth` and instead sends a manual header
`Authorization: Bearer {{ $env['LINE_CHANNEL_TOKEN_' + $json.project_id] }}`.

Adding a 5th tenant means adding one env var — no workflow graph change. Rejected:
one n8n Credential per project + a Switch node before every LINE call — safer at rest
(encrypted credential store) but the node graph would need a 4-way (soon N-way) branch
at every LINE call site, and onboarding a tenant means editing the graph, not just
configuration. The env-var pattern is already the house style for the per-tenant secret;
matching it for the token keeps one mental model. The token sits in n8n's environment
(private, self-hosted instance) — the same trust boundary the secret already relies on.

### 2. Signature verification is enforced, fail-closed, with a distinguishing log

An IF node is added immediately after "Parse Events & Redact" (before "Drop Noise"):
`signatureValid == false` → reject, do not insert, do not call WF2. This was already the
implicit behavior when no secret is configured (`channelSecret` empty → `signatureValid
= false` computed in-code) — the fix makes it enforced rather than merely computed. The
reject path logs which of the two reasons applied — no secret configured for this
project vs. a real signature mismatch — so a newly onboarded project that's silently
rejecting everything (ops forgot to set `LINE_CHANNEL_SECRET_<projectId>`) is
diagnosable, distinct from an actual spoofing attempt.

### 3. `admin_id > 0`, not `exists()`, decides whether a reply is human

`admin_id` is a `SERIAL` PK starting at 1; "is this reply from a real admin" is exactly
"is `admin_id` a positive integer" — a check that sidesteps whatever `exists()` does with
a present-but-null value entirely, rather than relying on n8n operator semantics under
null. Fixed alongside: "Normalize Payload" declared `admin_id` as type `string` although
it is an integer FK everywhere else in the schema — corrected to `number`.

### 4. No realtime (SSE) for v1 — polling only

Fixlo gets a lightweight poll on the inbox and thread pages (reusing the existing
`router.refresh()` pattern already used by `ReplyBox`/`DraftCard`), not a Postgres
`LISTEN`-backed SSE stream. Building a persistent-connection SSE layer (connection
lifecycle, reconnect, one `LISTEN` per server instance) is real infrastructure with no
current user — no agent has this in production yet, since the pipeline still needs
credentials wired before it runs at all. `pg_notify('crm_inbox_events', …)` stays as-is
in WF1/WF2 — an unused hook, not wasted work — and SSE can consume it later once agents
are actually working the inbox and polling latency is a felt problem, not a hypothetical
one.

## Consequences / risks

- LINE tokens/secrets live in n8n's environment in plaintext (not the encrypted
  credential store). Acceptable given the instance is private/self-hosted and the secret
  already lives there; revisit if n8n access control ever widens.
- Fail-closed signature enforcement means a misconfigured new project goes silently dark
  to customers until someone reads the distinguishing log — mitigated by the log split,
  not eliminated. No alerting is added in this ADR.
- Polling means a visible lag between a customer message landing and an agent seeing it
  update the inbox without a manual refresh — bounded by the poll interval chosen at
  implementation time (a few seconds), not instant.
- None of this ADR's changes populate real credentials — `LINE_CHANNEL_TOKEN_<projectId>`
  / `LINE_CHANNEL_SECRET_<projectId>` (×4) and a Postgres credential still require the
  operator to set real values in n8n before any workflow can be activated.

## Alternatives considered

- **n8n Credential objects + per-call Switch branching** (LINE auth) — rejected: doesn't
  scale the workflow graph with tenant count; env var does.
- **Soft-fail / log-only on bad signature** (current pre-fix behavior) — rejected:
  leaves an open injection path into the shared inbox and AI copilot (which also burns
  Gemini quota on spoofed traffic).
- **SSE now** — rejected for v1: real infrastructure cost with zero current users; the
  `pg_notify` calls already in place mean adding it later is additive, not a rework.
