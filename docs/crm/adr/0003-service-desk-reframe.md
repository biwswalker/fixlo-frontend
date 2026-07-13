---
id: "0003"
title: Reframe the CRM as a service desk (shared pool, first-responder FRT)
status: accepted
date: 2026-07-14
relates: ["crm 0001", "crm 0005"]
supersedes: ["new-feature-07.md §§ sales funnel / orders / round-robin"]
tags: [crm, domain, kpi, sla, scope]
---

# ADR 0003 — Service-desk reframe

## Context

The originating blueprint (`new-feature-07.md`) specifies a **sales CRM**: a
`Lead → Interested → Pending Payment → Closed` funnel, `orders` with `total_amount` /
`shipping_fee_discount` / `address`, per-agent **conversion rate**, and **round-robin**
assignment of each new customer to one owning admin.

A real LINE OA chat export (`20260416_20260705_0802518587.csv`, a JUNO168 VVIP) was
reviewed. It **contradicts the blueprint**:

- The customer is an **existing VIP player**, not a lead. There is no acquisition funnel.
- Conversations are **service**: withdrawal-status ("ถอนนานมาก", "เป็นชั่วโมงแล้ว"),
  deposit failures ("สร้างรายการฝากไม่ได้"), credit disputes ("เครดิตเข้าแค่200"),
  forgot-password, promotions. No product orders, no shipping, no address.
- **Many admins** (`อุ๋มอิ๋ม🐱`, `KID`, `BeeR`, `nut10`, `ying`, …) reply to the **same
  customer** — a shared pool, not one owner via round-robin.
- The genuine pain is **waiting** — an FRT/SLA problem, which the blueprint's KPI section
  models correctly.

## Decision

Reframe the CRM as a **service desk + AI copilot + agent FRT/SLA KPI**. Keep the
blueprint's KPI/SLA rules; drop its sales model.

1. **Drop the sales funnel.** No `Lead→Closed` stage machine, no conversion rate. `tier`
   is a VIP-status label (`Regular|VIP|VVIP`), not a funnel stage. Drop `orders`,
   `promotions`, `shipping_fee_discount`, `address` from the phase-1 core.

2. **Customer = existing player**, PK = LINE `user_id`. **No link** to `member_user` /
   `report_*` in phase 1 — CRM outcomes are self-contained; deposit attribution back to
   game-side data is deferred (member code format is unstable). An **optional `order`
   metadata hook** (a closed deposit amount per agent) may be added later; it is not the
   core and needs its own grill.

3. **Shared pool, not owned + round-robin.** The inbox is a team queue; any on-shift
   agent may reply. `assigned_admin_id` is **nullable/optional** (pin a VIP for follow-up,
   non-blocking). `case_transfers` is an optional audit log for deliberate VIP handoffs,
   not the primary flow.

4. **FRT = first-responder, session-scoped.** A **session** starts when the gap since a
   customer's previous message exceeds the **session gap** (default 6h, configurable).
   FRT = first-customer-message-of-session → first-admin-reply, credited to whoever
   replies first. Apply the blueprint's two guardrails:
   - **AI-handoff:** the admin FRT clock starts at the **handoff instant**, not the
     customer's first message.
   - **Operational hours:** count only within business hours (default 08:00–22:00);
     out-of-hours starts clamp to `08:00` next business day.
   - **SLA pass** = FRT ≤ threshold (default 600s).

5. **KPI is `mv_admin_kpi_daily` consumed in Fixlo** (per-agent FRT/SLA/reply counts),
   **not Looker Studio** — Looker cannot enforce the per-role PII masking + audit that
   [ADR 0004](0004-pii-masking-and-password-redaction.md) requires. Keep the materialized
   view + cron refresh; the consumer is a Fixlo page.

## Consequences / risks

- Scope shrinks to what the data supports; less to build, and the KPI actually targets the
  real pain (response time).
- No conversion metric in phase 1 — accepted; it needs game-side linkage we deliberately
  defer.
- First-responder FRT can be gamed by an agent firing a canned "รอสักครู่" to stop the
  clock. Mitigation: treat known holding-messages as non-terminal for FRT (tune during
  KB mining); revisit if abused.
- Session gap of 6h is a heuristic; exposed as config so ops can tune per observed traffic.

## Alternatives considered

- **Build the sales funnel as specified** — rejected: the real data has no funnel; we'd
  ship unused stages and a conversion metric with no signal.
- **Owned customers + round-robin** — rejected: contradicts the observed shared-pool
  behaviour; would fight how the team actually works.
- **Explicit open/close tickets for FRT** — rejected for phase 1: the team doesn't work
  that way today; gap-based sessions need no extra agent action.
- **Keep Looker for KPI** — rejected: cannot enforce PII masking/RBAC/audit.
