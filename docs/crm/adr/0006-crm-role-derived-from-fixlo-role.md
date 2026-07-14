---
id: "0006"
title: The CRM role is derived from the Fixlo role, not stored separately
status: accepted
date: 2026-07-14
relates: ["crm 0001 (bounded context / two axes)"]
supersedes: ["0001 §3 (crm_role as an independent per-project source)"]
tags: [crm, rbac, auth]
---

# ADR 0006 — CRM role derived from the Fixlo role

## Context

[ADR 0001](0001-crm-bounded-context.md) modelled the CRM permission axis
(`junior`/`supervisor`) as an **independent** per-project attribute stored in
`crm_agent_profile.crm_role`, to be hydrated into the session (tracked as issue
#157). Every CRM screen shipped (S1–S9) gated on a `crmRoleFromFixloRole` bridge
in the meantime.

In practice the team wants CRM authority to **track the Fixlo role directly** — a
Fixlo admin is a CRM supervisor, a Fixlo staff is a CRM junior. There is no
separate list of "who is a CRM supervisor" to maintain, and no need for the
external auth API to grow a new claim.

## Decision

The CRM role is a **deterministic function of the Fixlo role**, not an
independently sourced value.

| Fixlo role | CRM role |
|---|---|
| `owner` | `supervisor` |
| `admin` | `supervisor` |
| `staff` | `junior` |
| `viewer` / none | no CRM access |

- `crmRoleFromFixloRole` (in `src/lib/crmRole.ts`) is the **canonical resolver**,
  no longer a placeholder. CRM pages/actions call it with `session.user.role`.
- `crm_agent_profile.crm_role` remains a column (for attribution + future
  override) but is **not** the authorization source; it is seeded from the
  derived role when a profile row is auto-provisioned on first reply.
- No new session claim, no per-project role hydration, no external-auth change.

This closes issue #157 and the last gap in [PRD #155](https://github.com/biwswalker/fixlo-frontend/issues/155).

## Consequences / risks

- One place to reason about access: the Fixlo role. No drift between two
  role lists.
- Loses per-project CRM granularity (a person is the same CRM role on every
  project). Acceptable now; if per-project overrides are ever needed, reintroduce
  a `crm_agent_profile.crm_role` lookup that **falls back** to the derived role —
  the resolver is the only seam that changes.
- A Fixlo `viewer` has no CRM access at all; if view-only CRM access is wanted
  later, extend the mapping.

## Alternatives considered

- **Independent `crm_role` in `crm_agent_profile`** (ADR 0001's original plan) —
  rejected for now: extra administration (maintaining who is a supervisor) with no
  current need; the Fixlo role already expresses the seniority split.
- **A new claim from the external auth API** — rejected: couples CRM RBAC to a
  backend change; the auth API only returns the four Fixlo roles today.
