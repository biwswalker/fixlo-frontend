---
status: accepted
date: 2026-06-02
---

# Standardize app-owned created_at to UTC (matching transfer_at)

## Context

App-owned `created_at` columns are `timestamp without time zone` but store **Bangkok wall-clock**, because they default to `CURRENT_TIMESTAMP` and the DB session timezone is `Asia/Bangkok`. Meanwhile `transfer_at` (same column type) stores **UTC** (worker `toISOString()`, see ADR 0010). Two columns of identical type in the same row are 7 hours apart, and nothing in the schema signals which is which.

This surfaced twice during the issue #107 investigation:

- The frontend's `FailedSlipsTable` displays upload time via `toLocaleString({ timeZone: "Asia/Bangkok" })`. Because `src/lib/db.ts` parses OID 1114 as UTC, a Bangkok-naive `created_at` is read as UTC and displayed **+7h wrong**.
- The first spectre `resolveBalanceDate` (issue #107) had to special-case `created_at` as Bangkok-naive — a hidden coupling that is easy to get wrong (an earlier attempt double-shifted by 7h).

## Decision

Standardize **app-owned** `created_at` to UTC-naive, matching the `transfer_at` convention, so every `timestamp without time zone` in app tables means "a UTC instant".

Migration 044 (guarded, idempotent):

- Backfill existing rows `created_at = created_at - interval '7 hours'` (Thailand has no DST → fixed offset).
- Change the column default to `(now() AT TIME ZONE 'UTC')`.

**Scope — app-owned only** (written by fixlo / fixlo-spectre):
`raw_uploads`, `transactions`, `daily_balances`, `project_accounts`, `projects`.

**Excluded:**

- `report_*` — written by the Python scraper (fixlo-scraper, repo 3). Its `created_at` convention is owned there and out of scope; it stays Bangkok-naive until separately verified.
- `manual_transactions`, `transaction_types` — already `timestamptz` (unambiguous), no change.
- `manual_adjustments` — deprecated, 0 rows.

## Cross-repo impact

- **fixlo (frontend):** all `created_at` reads are display / `ORDER BY` only — no business-logic filter, no `::date`, no explicit insert. After migration the OID 1114 parser reads the now-UTC value correctly, so `FailedSlipsTable` (and any other display) becomes correct. Net positive, no code change required.
- **fixlo-spectre:** one business read — `resolveBalanceDate` via `worker.js`. After migration, `created_at` is a true UTC instant, so `resolveBalanceDate` adds +7h to reach the Bangkok wall-clock. Worker SQL unchanged. Paired branch: `chore/created-at-utc-followup` (PR #7, must deploy in the same window).

## Deploy order (must be lockstep)

Between the backfill and the spectre redeploy, `created_at` is UTC but the deployed `resolveBalanceDate` still assumes Bangkok-naive → balance dating is wrong. Therefore:

1. Pick a no-trigger window (staff not sending slips / running queue).
2. `pg_dump` backup.
3. Apply migration 044 (`migrate:apply`).
4. Deploy fixlo-spectre PR #7.
5. Resume; verify a fresh balance dates correctly.

Rollback: `044_..._rollback.sql` (+7h, revert default) **and** redeploy spectre back to the no-shift `resolveBalanceDate`, in the same window.

## Alternatives considered

- **Convert to `timestamptz`.** Cleaner type-level intent, but diverges from `transfer_at` (which stays `timestamp without time zone` UTC). Keeping the same type + same UTC convention across both columns is the smaller, more consistent change.
- **Set DB server timezone to UTC.** Fixes `CURRENT_TIMESTAMP` globally but is a much wider blast radius (every `now()`-based behaviour, all tables incl. scraper) and risks the excluded `report_*` tables. Rejected in favour of a scoped column migration.
- **Leave as-is, document only.** The caveat is documented in CONTEXT.md regardless, but the silent 7h trap and the existing frontend display bug justify the migration for app-owned tables.

## Consequences

- App tables gain a single, consistent timestamp convention (UTC) — `created_at` and `transfer_at` now agree.
- Frontend upload-time display is corrected for free.
- A new (accepted) inconsistency: `report_*.created_at` stays Bangkok-naive. Documented in CONTEXT.md; revisit if those tables ever feed time-sensitive logic.
- The migration and the spectre deploy are coupled and must run in one window — captured in the tracking issue runbook.
