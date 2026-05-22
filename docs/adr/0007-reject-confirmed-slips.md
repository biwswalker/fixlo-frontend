# ADR 0007 — Reject confirmed slips from SlipDrawer

## Status
Proposed

## Context

Slip rejection previously only applied to unconfirmed transactions (`PENDING_REVIEW` or `UNMAPPED` → `REJECTED`) via the match page. Operators discovered that slips sent to the wrong Discord channel could still be confirmed (`AUTO_MAPPED` or `MANUAL_MAPPED`) before the error was noticed — leaving incorrect amounts in reconciliation outflow with no recovery path short of direct DB edits.

## Decision

Extend the `reject` action to allow `AUTO_MAPPED | MANUAL_MAPPED → REJECTED`, triggered from the SlipDrawer in the reconciliation page. Bulk selection (multiple slips, one preset) is supported.

Rules unchanged:
- Requires `manage_projects` permission (owner + admin only)
- Must supply a reject reason (existing 5 presets + free text)
- Rejected transaction remains in DB for audit trail — not deleted
- `REJECTED` status is excluded from `getAccountSlips` query, so it drops out of outflow immediately

## Alternatives considered

**Re-route to correct project** — rejected slip would be re-queued for manual mapping to the correct `source_project_id`. Rejected because the source of truth is Discord: the operator should re-post the slip in the correct channel. Fixlo should not silently reassign ownership of a transaction.

## Consequences

State machine in `transactionState.ts` gains two new transitions. Future tooling that analyses rejection patterns should distinguish origin context (match page vs SlipDrawer) via `reject_reason` convention or a future `rejected_from` column.
