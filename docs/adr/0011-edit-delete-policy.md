---
id: "0011"
title: Edit/delete policy for transactions and daily_balances
status: accepted
date: 2026-05-28
tags: [schema, audit, rbac, transactions, daily_balances]
---

# ADR 0011 — Edit/delete policy by provenance

## Context

Admins need to correct or remove entries for `transactions` (Discord slip),
`manual_transactions`, and `daily_balances` (Discord/scraper/manual). Each
row carries different provenance:

- Discord slip — extracted by AI from `raw_uploads`. The AI output and
  raw image are the audit trail.
- Manual entry — admin-created in the dashboard.
- Discord/scraper `daily_balances` — extracted by AI or scraped from a
  gateway portal.

A single uniform edit/delete model would either erase the AI audit trail
(if everything is freely mutable) or block legitimate admin corrections
(if everything is immutable). REJECT already exists for "wrong slip,
keep for audit" ([ADR 0007](0007-reject-confirmed-slips.md)); delete is
distinct from reject.

## Decision

**Delete** is split by provenance:

- Discord slip (`transactions`) — **no delete**. Use REJECT
  (`matching_status = REJECTED`). `raw_uploads` must remain so the
  pipeline audit is intact.
- Manual slip (`manual_transactions`) — **hard delete**. Admin created
  it, admin owns it. Image file (if any) is left orphaned on disk;
  cleanup is an ops task.
- `daily_balances` (all sources) — **hard delete**. The table has no
  REJECTED state and does not contribute to reconciliation outflow.

**Edit** respects provenance:

- Discord slip — AI fields (`ai_amount`, `ref_id`, `acc_name`, image)
  are immutable. Amount override goes through `adjusted_amount`
  (existing slip-adjustment pattern). Metadata (`transfer_at`,
  `transaction_type`, `transaction_subtype`, `project_account_id`
  re-match) is editable.
- Manual entries — all fields editable.
- `daily_balances` with `source IN ('discord','scraper')` — editable
  only via re-match (`project_account_id`). To correct a wrong
  `balance_amount`, delete and re-add manually.
- `daily_balances` with `source = 'manual'` — all fields editable.

**Audit** uses inline columns on each table:

- `last_edited_by`, `last_edited_at`, `last_edited_note` (note optional)
- `deleted_at`, `deleted_by`, `delete_reason` (reason required)

**RBAC** — all edit and delete actions require `manage_projects`
(owner + admin). Staff continue to approve/reject slips only.

**UX guardrails:**

- Re-matching a `daily_balances` row forces `matching_status =
  MANUAL_MAPPED` and auto-appends the scanned name as a new alias on
  the chosen `project_accounts` row (existing `confirmBalanceMapping`
  behaviour, with the same alias-collision sanity check).
- Editing `balance_amount` (manual rows) or `transfer_at` (any
  transaction) shows a warning dialog because both shift the daily
  bucket and affect reconciliation for adjacent days.
- Edit/delete entry points are only in the row's detail drawer, not
  inline in tables — destructive actions go through detail view.

## Consequences

- Three tables (`transactions`, `manual_transactions`, `daily_balances`)
  gain six audit columns each. Migration is additive, no backfill
  required.
- A manual `daily_balances` row cannot be added when any row already
  exists for `(project_account_id, date)` — see Req 2 in the source
  conversation. The existing migration plan adds `UNIQUE (date,
  account_name)` to enforce this at the DB level. The add-dialog
  pre-checks and offers a "go edit the existing row" redirect.
- Image files referenced by deleted `manual_transactions` /
  `daily_balances` become orphans. Disk usage is bounded; an ops-side
  cleanup script can sweep based on missing row references.
- REJECT and delete are now semantically distinct on `transactions`:
  REJECT preserves the row with a reason; delete is unavailable. This
  is deliberate — it forces every Discord slip to remain in the audit
  trail.
