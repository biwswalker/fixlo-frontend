---
id: "0013"
title: Project canonical identifier — integer FK + code natural key
status: accepted
date: 2026-05-29
tags: [schema, project, multi-tenant, refactor]
---

# ADR 0013 — Project canonical identifier

## Context

Activating additional projects (ids 2–4: `uno`, `gaza`, `yb`) surfaced
long-standing schema debt around how a "project" is referenced across
tables. Current state:

- `projects.id integer PK` (sequence).
- `raw_uploads.source_project_id`, `transactions.source_project_id` —
  `integer FK REFERENCES projects(id)` ✅
- `project_accounts.project_id`, `manual_adjustments.project_id`,
  `report_summary_daily.project_id` — `varchar` storing the literal
  project code (e.g. `'juno168'`). **No FK.**
- `daily_balances.project_name text` — denormalised name string written
  by the bot at INSERT time. No FK.
- `report_deposits`, `report_withdrawals`, `report_manual_credit_*`,
  `report_manual_bonus_*` — **no project column at all**. Single-tenant
  by accident; everything is implicitly `juno168`.

Compounding bugs:

- `src/lib/projects.ts:resolveProject` uses `project_name ILIKE '%' || $1
  || '%'`. Activating `uno` makes `/dashboard/uno/...` match both
  `juno168` (substring `uno`) and `uno168`.
- `bot.js:getProjectByName` does exact `project_name` equality for
  cross-project lending (`#<project>` caption). Brittle to display-name
  renames.
- `getProjectOptions` returns `id` as the URL slug yet routes use
  `project_name`-shaped slugs — inconsistent already.

The scraper is going to be rewritten anyway (per-project integration is
deferred but inevitable), so the cost of breaking its current write
contract is zero.

## Decision

**One canonical project key, two surface forms.**

1. `projects.id integer PK` is the **only** cross-table reference. Every
   table that points at a project uses `project_id integer NOT NULL
   REFERENCES projects(id)`.
2. `projects.code text UNIQUE NOT NULL` is a stable, human-readable
   natural key. It is the URL slug (`/dashboard/<code>/...`) and the
   token staff type in Discord (`#<code>` or `#<alias>`). It is
   immutable after creation.
3. `projects.project_name text` is a mutable **display label** only. Not
   used for joins, lookups, or routing.
4. `projects.aliases text[]` holds short forms staff actually type
   (`['juno', 'jn']`). Cross-project lending matches case-insensitive
   against `code` OR any alias.
5. ACTIVE invariant enforced by CHECK:
   `status != 'ACTIVE' OR (discord_channel_id IS NOT NULL AND
   active_date IS NOT NULL)`.

### Validation rules

- `code`: `^[a-z0-9]+$`, length 2–32. Immutable after creation
  (enforced as UI rule + convention; no DB trigger).
- `aliases[]`: each element same charset as `code`.
- Uniqueness: a string must not appear as `code` OR `aliases` element
  in more than one project. Enforced in server action at create/edit
  time (pre-flight query). No DB-level functional index — trivial check
  at this scale.

### Seed values

| id | project_name | code      | aliases           |
|----|--------------|-----------|-------------------|
| 1  | juno168      | juno168   | `{juno, jn}`      |
| 2  | uno168       | uno168    | `{uno}`           |
| 3  | gaza168      | gaza168   | `{gaza}`          |
| 4  | yb168        | yb168     | `{yb}`            |

### Migration plan

0. **Pre-flight** (fail-loud, abort migration on orphan):
   ```sql
   DO $$ BEGIN
     IF EXISTS (
       SELECT 1 FROM project_accounts t
       WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.code = t.project_id)
     ) THEN RAISE EXCEPTION 'orphan project_accounts.project_id'; END IF;
     -- repeat for manual_adjustments, report_summary_daily, daily_balances.project_name
   END $$;
   ```
   No silent backfill. Admin fixes data manually then reruns.
1. `ALTER TABLE projects ADD COLUMN code text`. Backfill from seed
   table. `ALTER COLUMN code SET NOT NULL`, add `UNIQUE`.
2. `ALTER TABLE projects ADD COLUMN aliases text[] NOT NULL DEFAULT
   '{}'`. Backfill from seed.
3. `UPDATE projects SET project_name = '<code>168'` for id 1 rename.
4. For each table with `project_id varchar`:
   - Add `project_id_new integer`.
   - `UPDATE t SET project_id_new = p.id FROM projects p WHERE
     t.project_id = p.code`.
   - Drop old, rename new, add `NOT NULL` + `FK`.
5. `daily_balances`: add `project_id integer`. Backfill via
   `project_account_id → project_accounts.project_id` for matched rows;
   unmatched rows backfilled by channel→project lookup recorded by bot.
   Drop `project_name`. Add `NOT NULL` + `FK`. Bot updated to set
   `project_id` at INSERT.
6. `report_*` (deposits, withdrawals, manual_credit_*, manual_bonus_*):
   `ADD COLUMN project_id integer NOT NULL DEFAULT 1` + FK. Existing
   rows backfill to 1. Scraper rewrite later populates per-project
   values; the column is in place from day one.
7. Add CHECK constraint for ACTIVE invariant.
8. Frontend: refactor `resolveProject`/`getProjectByName` to
   `WHERE code = $1` (exact, drop ILIKE). All action-layer queries
   resolve URL slug (code) → integer id → filter `WHERE project_id =
   $1`. Switcher returns `{id, code, label}`.
9. Bot: cache `projectsData` continues to load on start. Activating a
   new project = manual SQL UPDATE + bot restart (no hot reload, scoped
   out — onboard frequency is low).
10. Cross-project lending: `getProjectByName` replaced with lookup
    against `code` OR `aliases` (case-insensitive).

### In scope (this migration window)

- Basic admin CRUD UI at `/dashboard/admin/projects` — list, create,
  edit (`project_name`, `discord_channel_id`, `active_date`,
  `aliases`), status toggle. `code` immutable after creation.
  Permission: `manage_projects` (owner + admin).
- Project refactor is its own migration window; date/QR/users
  refactor (CONTEXT migration plan §192) bundled later.

### Out of scope

- Hot reload of bot project cache. Activate flow = manual SQL
  UPDATE + bot restart scheduled off-hours.
- Scraper multi-tenant rewrite (deferred; column is ready when scraper
  is).
- URL redirect for old bookmarks: resolver tries `code` exact match
  first, falls back to `aliases` array element match. Dual-purpose with
  Discord lending aliases. Zero config; delete from `aliases` to
  deprecate.

## Consequences

**Positive**
- One join key everywhere. FK enforcement makes orphan rows impossible.
- URL slug (`code`) is stable across display renames.
- Activating a new tenant is a row insert + master accounts + bot
  restart. No schema change per tenant.
- `report_*` tables ready for multi-tenant the moment scraper is
  rewritten; no second migration window needed.

**Negative**
- Big-bang migration touches every table that references a project.
  Must be coordinated with bot + frontend deploy in the same window.
- Existing `/dashboard/juno/...` URLs break after rename to
  `juno168`. Mitigation TBD (redirect map or grace alias).
- `projects.code` immutability is a social rule, not enforced. A future
  ADR could add a trigger.

## Alternatives considered

- **Varchar code everywhere, drop integer id.** Rejected — breaks
  existing integer FKs in `raw_uploads`/`transactions` (large tables),
  and natural keys mutating is a known footgun.
- **Keep varchar `project_id` columns, add CHECK against
  `(SELECT code FROM projects)`.** Rejected — leaves the FK gap, can't
  use referential actions, perpetuates ad-hoc schema.
- **Hybrid: integer FK on new tables, leave varchar on legacy.**
  Rejected — the cost of fixing all at once during the already-planned
  big-bang window is lower than carrying the inconsistency.
