---
id: "0001"
title: CRM is a separate bounded context sharing Fixlo's kernel
status: accepted
date: 2026-07-14
relates: ["reconciliation 0013 (project canonical identifier)"]
tags: [crm, bounded-context, architecture, rbac]
---

# ADR 0001 — CRM is a separate bounded context

## Context

Fixlo is an iGaming **reconciliation** system: Discord slips → AI → match master accounts
→ กระทบยอด. A new requirement adds a **LINE service desk / CRM** for existing VIP players
(chat inbox, AI copilot, agent FRT/SLA KPI). The two share almost no domain vocabulary:
reconciliation is about money movement between bank accounts; CRM is about customer
conversations and agent response time.

They **do** share infrastructure: one Next.js app, one PostgreSQL instance, one external
auth provider, and the `projects` tenant table (a project = a casino brand = one LINE OA).

The word **"customer"** is the trap: in reconciliation the "customer/tenant" is the casino
**project**; in CRM the "customer" is a **LINE player**. Folding both into one glossary
guarantees confusion.

## Decision

Model CRM as a **second bounded context** alongside reconciliation, sharing a kernel, not
merging models.

1. **Separate domain docs.** Add root [`CONTEXT-MAP.md`](../../../CONTEXT-MAP.md). Keep the
   existing root `CONTEXT.md` as the reconciliation context. CRM gets its own
   `docs/crm/CONTEXT.md` + `docs/crm/adr/`.

2. **Shared kernel** (the only shared concepts):
   - `projects` — both contexts scope by `project_id`. CRM adds `project_id` to every CRM
     table (multi-tenant, one LINE OA per project).
   - **Fixlo identity** — one user from the external auth API.
   - **Gemini** — same provider, different pipelines.

3. **Two separate permission axes.** Reconciliation authorization uses the Fixlo role
   (`owner|admin|staff|viewer`). CRM authorization uses a **new axis** `crm_role`
   (`junior|supervisor`) stored per project in a companion table `crm_agent_profile`
   (also holds `shift_start/end`, `last_assigned_at`). A person can be a CRM `junior`
   without any reconciliation privilege, and vice versa. The axes never mix; do not extend
   the Fixlo role enum with sales/service values.

4. **No shared tables between the two domains' cores.** CRM `customers`/`chat_messages`/
   `bot_knowledge_base` are new tables. CRM does not read/write reconciliation's
   `transactions`/`report_*` in phase 1 (see [ADR 0003](0003-service-desk-reframe.md)).

## Consequences / risks

- Two glossaries to keep honest, but each stays small and unambiguous. "Customer" can
  never be mistaken for "project".
- `crm_agent_profile` is a join between an external-auth identity and CRM attributes; the
  external user id must be stable enough to key on (it is — already used across the app).
- Navigation must present both contexts without clutter — solved by a grouped, role-
  filtered sidebar (not a separate app).
- Sharing one database keeps ops simple (one backup, one migration stream) at the cost of
  a larger schema; acceptable given the small team and single instance.

## Alternatives considered

- **One growing context / one glossary** — rejected: "customer" collision and an
  ever-lengthening `CONTEXT.md` mixing money-movement and conversation vocabulary.
- **Separate app + separate database** — rejected for phase 1: doubles ops (auth, deploy,
  backup, project table sync) for a small team; the contexts genuinely share the tenant
  and identity kernel.
- **Extend the Fixlo role enum with `junior`/`supervisor`** — rejected: conflates two
  orthogonal permission axes (money ops vs service); a reconciliation `staff` is unrelated
  to a CRM `junior`.
