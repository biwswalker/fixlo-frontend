---
id: "0020"
title: Cross-account transfer attribution (internal carve-out + cross-project outflow)
status: amended
date: 2026-06-14
relates: ["0008 (transaction type)", "0013 (project code + aliases)", "0018 (parking carve-out)", "0019 (slip-note classification)"]
tags: [reconciliation, cross-project, withdrawal, slip-pipeline, classification]
---

# ADR 0020 — Cross-account transfer attribution

> **Amendment (2026-06-14, same day).** Decisions **§2 and §3** below — the
> game-side-vs-slip-side *Withdrawal reconciliation* surface and its
> target-attribution rule — are **superseded** by **§5** before reaching `main`.
> They were implemented (PRs #145/#146) but the *diff* framing (per-project game
> withdrawals vs slip payouts) did not answer the operator's actual question.
> What is wanted is a **Cross-project outflow** breakdown: from the current
> project's view, *which of my accounts sent money to which other project, how
> much, and what kind*. The `withdrawalReconciliation` module and the
> "กระทบยอดถอน (เว็บ vs สลิป)" UI section are removed.
>
> **Decision §1 (internal-transfer carve of ยอดรับ) stands** — an independent
> formula-correctness fix (PR #147), unaffected by this amendment. The §1
> detection (2-tier receiver match) is **reused** by §5 to label the
> *capital-lending* kind of outflow.

> **Amendment (2026-06-15).** §5's **"ไม่ระบุโปรเจกต์" bucket is removed.** A null
> `target_project_id` means neither the Discord caption nor the slip note resolved a
> project (ADR 0019 §4) — i.e. a normal **same-project** withdrawal, not cross-project.
> The original bucket keyed on *any non-empty slip note*, which wrongly swept in
> same-project "ถอนให้ลูกค้า" payouts. The "names a project but unresolved" worklist
> the bucket aimed at is not detectable from `target_project_id` alone and already
> lives in `SlipReviewDialog` (ADR 0019 §4–5). The section now lists **only resolved
> cross-project rows** (`target_project_id` set and ≠ source). The project column(s)
> are **vertically merged (rowspan)**, grouped contiguously by target (in `all` mode,
> nested under source), ordered by descending group sum.

## Context

A withdrawal slip (master → out) can move money in ways that distort the per-project
reconciliation if treated as a plain player payout. Two patterns surface, both
**derived entirely from the slip** (Discord caption + slip note + receiver fields) — no
new scrape source:

1. **Internal transfer** — account A (project Juno) sends to account B (project Uno),
   where **B is itself a master account**. This is capital movement, not a player
   payout. A's outflow nets out correctly on A's side, but B's balance rises with no
   slip of its own, so B's `ยอดรับ` (player inflow) is **inflated** — the same
   double-count shape as gateway parking (ADR 0018).

2. **Cross-project player withdrawal** — A's account pays **another project's player**
   (slip note `ถอนให้ลูกค้า uno`, `target_project_id` = Uno, receiver = a player). The
   cash leaves Juno's account, but economically it is Uno's player withdrawal. Game-side
   `report_withdrawals` already books it under Uno (scraped per platform), while the
   slip sits under Juno → a per-project withdrawal mismatch.

This is the phase-2 calc change that ADR 0019 §6 deferred pending a fresh grill. That
grill happened (2026-06-14).

The distinguishing signal between the two is the **receiver**: a master account →
internal transfer; a player → cross-project withdrawal.

Historical volume (16,249 transactions): receiver = master account ≈ 3 (case 1, rare);
`target_project_id` ≠ source ≈ 192 (case 2, the real volume).

## Decision

### 1. Internal transfer — carve the inflow from the receiving account's ยอดรับ

Detected at **query time** in reconciliation: 2-tier match (digits-only
`receiver_acc_num` → exact `receiver_name`, mirroring ADR 0018/050) of every outgoing
slip's receiver against `project_accounts`. A match means the slip is an internal
transfer into that master account B.

Formula effect — sibling of the parking carve-out:

```
ยอดรับ_B = (balance_D − balance_(D-1)) + effectiveOutflow_B − parking_in_B − internal_in_B
```

where `internal_in_(B,D)` = Σ amount of other accounts' slips whose receiver = B on day D.

- **Sending side (A) is untouched**: the slip stays in `effectiveOutflow_A`, so
  `ยอดรับ_A` nets to 0 on its own. Removing it would push `ยอดรับ_A` negative.
- Receiver fields are populated on 99.9% of rows, so **no migration, no worker change,
  no backfill**. A managed type `โอนระหว่างบัญชี` is an optional later label, not the
  detection mechanism.
- Ambiguous receiver match (name collides with >1 master) → **skip** (do not carve).
  Conservative: better to leave a rare inflated `ยอดรับ` than to silently carve wrongly.

### 2. Cross-project player withdrawal — attribute slip-side withdrawal to the target

> **⚠️ SUPERSEDED by §5 (see amendment at top).** Kept for the historical record.

A **new Withdrawal reconciliation** section compares, per project per day:

- **game-side** = `report_withdrawals` (status `สำเร็จ`) — the canonical KPI (ADR 0004),
  unchanged. It is scraped per platform and already correctly attributed.
- **slip-side player payout** = `Σ COALESCE(adjusted_amount, ai_amount)` of slips where
  `transaction_type = ถอนให้ลูกค้า OR type IS NULL`, **excluding** types classified as
  non-player (`รายจ่าย`, `โอนไบแนน`) and excluding internal transfers (§1). Attributed
  to `target_project_id` when set, else `source_project_id`.

This is the first time `transaction_type` affects a calculation (phase 2 of ADR 0019).

**Null type defaults to counting** as a player payout: the slip pipeline is "withdrawal
slips, master → player" by construction, and only ~6.5% of rows carry a slip note today.
Defaulting null → excluded would collapse the slip-side total to near zero. Only types
**explicitly** classified as non-player carve out.

### 3. Two distinct settlement rules, keyed on the receiver

> **⚠️ SUPERSEDED by §5 (see amendment at top).** The receiver-keyed *distinction*
> below is still true and is reused by §5 as the **type/kind** column; what is dropped
> is the "attribute slip-side withdrawal to the target" *reconciliation* consequence.

The earlier guidance "cross-project withdrawal counts on `source_project_id`; the target
does not count" (CONTEXT schema-debt §8) holds **only for capital lending and the
game-side KPI**. It does **not** apply to paying the target's player:

| event | receiver | slip type | meaning |
|---|---|---|---|
| capital lending (§1 internal transfer) | master of target | — | carve inflow from target master's ยอดรับ |
| paying target's player | player | `ถอนให้ลูกค้า` | the target's player was paid from this account |

### 4. Phasing

> **⚠️ SUPERSEDED by §5.** §1 (carve) shipped via PR #147 and stands. §2/§3 shipped via
> PRs #145/#146 and are removed by the §5 amendment.

### 5. Cross-project outflow breakdown (amendment — replaces §2/§3 UI)

From the **current project's perspective**, a reconciliation-page section lists money
that left **this project's accounts** toward **another project**, for the selected day.

- **Scope** — `transactions` (Discord slips) where `source_project_id` = current project
  and the money is destined for a different project. `manual_transactions` carry no
  `target_project_id`, so they are out of scope.
- **A row is grouped by** `(target project × source account × type)`. Each row shows the
  summed amount (`Σ COALESCE(adjusted_amount, ai_amount)`) and a transaction count.
- **Two kinds, shown via a type column** (reusing §1/§3's receiver distinction):
  *capital lending* (receiver = a master account) and *paying the target's player*
  (receiver = a player, type `ถอนให้ลูกค้า`).
- **Unmatched source accounts are still shown** (the money did leave, the account
  just isn't mapped yet): a slip with no matched source account falls into a
  **"ยังไม่จับคู่บัญชี"** bucket.
- **Day-scoped** to the page's global date filter.
- **`projectId='all'` mode** shows every cross-project pair (`source ≠ target`) with an
  added **source project** column — a system-wide lending map.
- This is a **display / attribution** surface only. It does **not** touch the `ยอดรับ`
  formula (§1's carve is the only formula change) and does **not** compute a game-vs-slip
  diff.

## Consequences / risks

- §1's carve is unaffected; the deposit reconciliation and `ยอดรับ` math are unchanged.
- §5 is read-only over existing columns — no schema, worker, or migration change.
- Surfacing unmatched / unresolved buckets means the section also acts as a worklist:
  a non-empty "ไม่ระบุโปรเจกต์" bucket tells the admin which slips still need classifying.
- Query-time internal-transfer detection (§1, reused for the *kind* label) re-reads
  receiver matches each load; volume is tiny so cost is negligible.

## Alternatives considered

- **Keep the §2/§3 game-vs-slip Withdrawal reconciliation diff** — rejected by the
  follow-up grill: the per-project diff did not answer "where did my money go"; the
  source-side outflow breakdown does.
- **Classify-time detection of internal transfers (new column/flag in worker)** —
  rejected for now: receiver data already exists, query-time needs no migration/backfill.
- **Only show resolved `target_project_id` rows** — rejected: hides money that left and
  removes the worklist value of the unresolved bucket.
- **Carve the sending side (A) out of `effectiveOutflow` for internal transfers** —
  rejected: would push `ยอดรับ_A` negative; the outflow must stay for the balance math.
