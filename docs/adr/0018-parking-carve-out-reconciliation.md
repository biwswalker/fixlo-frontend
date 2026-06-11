---
id: "0018"
title: Parking carve-out into reconciliation (phase 2 of ADR 0017)
status: accepted
date: 2026-06-11
relates: ["0017 (resolves deferred phase-2)", "0016 (Apay into formula)"]
tags: [reconciliation, parking, apay, kpi]
---

# ADR 0018 — Parking carve-out into reconciliation

## Context

ADR 0017 captured [[Gateway parking withdrawal]] rows (gateway sweeping funds into a
project's master bank account) but deliberately deferred reconciliation integration
("capture-first"). This ADR resolves that deferred phase.

The core problem is **double-counting**. Money that gets parked was already counted
once as an Apay gateway deposit (`report_apay_daily.deposit_amount`, which figures
into KPI card 2 "ยอดเข้าระบบ(สลิป)" via the Apay report-sourced row — ADR 0016). When
that same money is later swept into a bank master account, the master's end-of-day
balance rises, so the per-account inflow formula [[ยอดรับ]] =
`(balance_D − balance_(D-1)) + effectiveOutflow_D` counts it **again**.

The operator's stated goal: separate a master's incoming money into "from players"
vs "from internal movement (parking)", so card 2 (and therefore card 4 "ส่วนต่าง")
reflect the true web-vs-slip gap instead of parking noise.

**Prerequisite:** implementation is gated on real parking data flowing (PARKING_ENABLED
live, ADR 0017). The design below is decided; do not ship the formula change before
validating against real numbers.

## Decision

### 1. Carve parking out of per-account ยอดรับ

```
ยอดรับ_player(account, D) = (balance_D − balance_(D-1)) + effectiveOutflow_D − parking_in_D
```

where

```
parking_in_D(account) = Σ amount
  FROM gateway_parking_withdrawals
  WHERE project_account_id = account
    AND status = 'Approved'
    AND (transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date = D
```

- `amount` = the **net** received (request − refund), which is what actually lands in
  the master and inflates its balance — not `request_amount`.
- Only `status = 'Approved'` counts: Pending/Rejected never reached the bank, so the
  balance did not move and there is nothing to carve.
- Date attribution uses the standard Bangkok cast (consistent with every other
  day-filter), matching the parking against the day whose EOD balance it inflated.

The carve lives inside `computePerAccountInflow` (the non-null balance branch). When a
balance snapshot is missing the account already yields null (not summed into card 2),
so parking is irrelevant there — no special handling.

### 2. project_account_id FK on gateway_parking_withdrawals (nullable)

Add `project_account_id` FK, resolved by matching the captured `account_number`
against `project_accounts.account_number`. **Nullable**: parking does not always hit a
registered master (admin may not have added that project_account).

**FK-null parking is harmless to the formula**: an unregistered destination has no
balance snapshot, so its balance never inflates, so there is no double-count to remove.
Such rows are display/audit only and are surfaced (see §4) so admins can register the
account if they want it reconciled.

### 3. KPI propagation — no relabel

card 2 "ยอดเข้าระบบ(สลิป)" = Σ ยอดรับ across accounts, so carving per-account makes
card 2 player-only automatically. card 4 "ส่วนต่าง" = |card1 − card2| then drops the
parking noise — **this is the goal**. No relabel needed: the carve makes both cards
match their existing names more truthfully. card 1 "ยอดเข้าระบบ(เว็บ)" untouched.

**Apay rows are never carved.** The Apay row is `reportSourced` (ยอดรับ = deposit_amount
via the gateway-inflow branch, not `computePerAccountInflow`), so the carve cannot
apply to it by construction — even if a parking row's account_number somehow matched
the Apay account. Parking destinations are real bank masters, not the gateway account.
Net result: parked money is counted exactly once (at Apay deposit), never at the bank
master.

### 4. Display

- **AccountBreakdownTable**: the ยอดรับ cell shows the **carved (player-only)** value,
  with a small sub-line annotation `(− ฿X โยกเข้า)` so the operator sees how much was
  carved. No new column (keeps the table narrow).
- **Negative ยอดรับ is shown as-is** (not floored at 0), with a colour flag. A negative
  player-inflow means the recorded parking exceeds the observed balance delta — a
  data/timing discrepancy that reconciliation exists to surface. Flooring would hide it.
- **FK-null parking**: a lightweight warning (e.g. banner "มี parking ฿X เข้า account
  ที่ยังไม่ลงทะเบียน") prompts the admin to register the destination account.

## Consequences / risks

- Formula now depends on a third table (`gateway_parking_withdrawals`) beyond
  balances/transactions/manual — more moving parts in the hot reconciliation path.
- Correctness hinges on the `account_number` match being clean; format drift
  (spacing/dashes) could misattribute or drop a carve. Normalise on match.
- Negative ยอดรับ may confuse operators until the data-quality cause is fixed; the
  colour flag + this ADR are the explanation.
- Parking status is mutable (Pending→Approved); because reconciliation is computed live
  per view (not materialised), a later status flip is picked up on the next view.

## Alternatives considered

- **Display-only, don't carve** — rejected: leaves the double-count in card 2/card 4;
  operator explicitly wants accuracy, not just visibility.
- **Floor negative ยอดรับ at 0** — rejected: hides genuine balance/parking discrepancies.
- **Match parking→account at query time (no FK)** — rejected: reconciliation is a hot
  path; per-query fuzzy JOIN is slower and harder to debug than an explicit FK.
- **Carve at the KPI level only (not per-account)** — rejected: loses per-account
  transparency; the breakdown table is where operators investigate.
