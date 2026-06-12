# ADR 0008 — Transaction type as admin-managed table, sub-type as freetext

## Status
Accepted — implemented (migrations 026 `transaction_types`, 027 `transaction_type_id` + `transaction_subtype`). Phase 1 (metadata) live. The type/subtype infra is reused by [ADR 0019](0019-slip-note-classification.md) for AI slip-note classification.

## Context

Slips (both Discord and manual) need a category label for reporting and, in a later phase, differentiated reconciliation calculation. Candidates are: a fixed enum, a freetext column with autocomplete, or a managed lookup table.

## Decision

**Type (tier 1)** — stored in a separate `transaction_types` table, managed by admin through UI. `transactions` and `manual_transactions` each gain a `transaction_type_id` FK (nullable — existing rows have no type).

**Sub-type (tier 2)** — freetext `transaction_subtype` varchar column on both tables. UI shows autocomplete from `DISTINCT transaction_subtype` values. Optional for every type.

## Why not freetext for type too?

Phase 2 requires mapping each type to a calculation rule (e.g., "โอนเก็บ" excluded from effective outflow, "ถอน" counted in a separate column). A freetext type cannot be reliably mapped — any typo or synonym creates a silent calculation error. A managed table gives each type a stable `id` to attach rules to.

Sub-type is display-only metadata with no calculation consequence, so freetext + autocomplete is sufficient and more ergonomic.

## Phase boundary

Phase 1 (current): `transaction_type_id` and `transaction_subtype` are pure metadata. Reconciliation formula unchanged.

Phase 2 (future): `transaction_types` gains a `calculation_rule` enum column. Reconciliation queries join on type to apply per-type treatment. No data migration needed — the FK is already there.

## Consequences

- New `transaction_types` table + admin CRUD UI required before any slip can be typed.
- `transactions` and `manual_transactions` each need a nullable FK migration.
- Type set at manual-entry creation time; editable later from SlipDrawer for both sources.
