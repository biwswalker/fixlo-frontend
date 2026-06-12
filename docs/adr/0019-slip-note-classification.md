---
id: "0019"
title: AI classification of Discord slips from the slip note
status: accepted
date: 2026-06-12
relates: ["0008 (transaction type/subtype infra)", "0013 (project code + aliases)"]
tags: [classification, slip-pipeline, transaction-type, cross-project, ai]
---

# ADR 0019 — AI classification of Discord slips from the slip note

## Context

Staff type a memo in their banking app when making a withdrawal; it is printed on
the slip image (the field's label varies per bank: บันทึก / โน๊ต / ...). The memo
encodes both **what the payment was for** ("ถอนให้ลูกค้า", "ไบแนน", "ค่าเงินเดือน",
"ค่าการตลาด", …) and, for cross-project lending, **whose player was paid**
("ถอนให้ลูกค้า gaza" = juno168's account paid gaza's player).

Today the slip pipeline extracts amounts/accounts but does not classify the payment,
and cross-project lending is inferred only from the Discord caption (`#<alias>` →
Fuse.js in bot.js). The goal is to have the AI read the slip note and classify each
Discord slip so operators can see where the money went.

The existing transaction-type infra (ADR 0008) and cross-project FKs
(`source_project_id` / `target_project_id`) are already in place.

## Decision

### 1. Capture the slip note

Add `transactions.slip_note text`. The spectre worker OCRs the bank memo (whatever its
field label) and stores it raw. It is the audit source of the classification and is
admin-editable. (Stored as its own column, not buried in `raw_ai_output`, because it
drives classification and must be queryable/visible.)

### 2. Two orthogonal classification outputs

The single note string yields two independent outputs mapped to different columns:

**(A) Expense category — 2 tier (reuse ADR 0008)**
- **type** (`transaction_type_id`, managed): the AI picks the best matching managed
  type — e.g. `ถอนให้ลูกค้า`, `โอนไบแนน`, `รายจ่าย`. Managed so phase-2 calc rules can
  attach to a stable id.
- **subtype** (`transaction_subtype`, freetext): AI-extracted detail under the type —
  e.g. `ค่าเงินเดือน`, `ค่าการตลาด` under `รายจ่าย`.

**(B) Cross-project target** (`target_project_id`): the project alias suffix in the
note ("gaza", "uno") matched against `projects.code` + `projects.aliases`
(case-insensitive). No suffix → no target (a normal same-project player withdrawal).

### 3. Binance is a type, not an account

"ไบแนน" → transaction_type `โอนไบแนน`. Binance is a **destination of an outflow**, not
a master account we receive slips for / hold daily balance for / reconcile. If binance
balance tracking is ever wanted, do it as a gateway (cf. Apay), not a project_account.

### 4. Dual-source target with conflict review

`target_project_id` has two candidate signals — the Discord caption (Fuse) and the
slip note (AI) — both of which staff still produce. Resolution:

| caption | slip note | result |
|---|---|---|
| gaza | gaza | AUTO → gaza |
| gaza | uno | **conflict → PENDING admin** |
| gaza | (no suffix) | AUTO → gaza (note doesn't contradict) |
| (none) | gaza | AUTO → gaza |
| (none) | (none) | no target (internal same-project withdrawal) |

Conflict = **both name a project and they differ**. It is surfaced and resolved in the
existing `SlipReviewDialog` — no new page.

### 5. Confidence + non-blocking

- AI confident → auto-assign type/subtype/target immediately.
- AI unsure / no managed type fits → `transaction_type_id` null → appears in a backlog
  for an admin to classify. The AI does not guess.
- Admin can always override type/subtype/target later in SlipDrawer.
- **Type-null never blocks**: an unclassified slip still counts as a normal outflow in
  reconciliation and is unaffected by account matching. Classification and account
  matching are two independent review dimensions.

### 6. Phase boundary — classify + display, defer calc

The balance reconciliation `ยอดรับ = balance_delta + effectiveOutflow` adds back **every**
outflow (player payout, salary, binance alike all reduce the balance), so the type does
**not** change the formula. Classification's value is reporting/visibility.

- **Phase 1 (this ADR):** classify + store + display the outflow broken down by type —
  (ก) badges in the per-account SlipDrawer, (ข) a "รายจ่ายแยกตามประเภท" summary section on
  the reconciliation page, (ง) a type column/sub-line in AccountBreakdownTable. No
  formula change.
- **Phase 2 (deferred):** if a type should ever change a calculation (e.g. exclude
  expenses from a "paid-to-players" figure), **that requires a fresh grill first** — do
  not touch the formula without one. A full standalone report + export (ค) is also
  deferred.

Cross-project attribution is unchanged: this work only **populates `target_project_id`
more accurately** from the note; it does not alter how reconciliation uses source/target.

## Consequences / risks

- OCR of a free-form memo with bank-varying field labels is error-prone → hence the
  unsure→null→backlog path and always-available admin override.
- Two target signals can disagree; the PENDING path adds an admin step but prevents a
  silent wrong attribution.
- The managed type list must be seeded (`ถอนให้ลูกค้า`, `โอนไบแนน`, `รายจ่าย`) before the
  AI can map to it; admins extend it via the existing CRUD UI.
- Phase-1 display surfaces add a type dimension to existing tables without touching the
  reconciliation formula — safe to ship incrementally.

## Alternatives considered

- **Freetext type (no managed table)** — rejected (ADR 0008): no stable id for phase-2
  calc, synonyms/typos cause silent miscategorisation.
- **Binance as a project_account** — rejected: it is an outflow destination, not a
  reconciled master; modelling it as an account would distort balance/matching.
- **Slip note replaces the Discord caption mechanism** — rejected: staff still type
  captions; keeping both (with conflict review) is more robust than dropping one.
- **Block slips until classified** — rejected: type is phase-1 metadata; blocking would
  stall the pipeline for a non-calculation field.
- **Auto-resolve target conflicts (pick one source)** — rejected: a wrong cross-project
  attribution is hard to notice later; admin review is cheap insurance.
