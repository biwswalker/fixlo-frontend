---
id: "0010"
title: transfer_at storage convention — UTC across worker + manual writes
status: accepted
date: 2026-05-28
tags: [timezone, schema, reconciliation, worker]
---

# ADR 0010 — `transfer_at` UTC convention

## Context

`transactions.transfer_at` and `manual_transactions.transfer_at` are
`timestamp without time zone` columns. They are written from two places:

- **worker write** — `fixlo-spectre/worker.js` builds a Bangkok local
  string and converts to UTC via `Date.toISOString()`.
- **manual write** — `src/actions/dashboard.ts` (`saveTransactionOcrResult`)
  for slips, and Manual Slip / Manual Balance forms in the dashboard,
  through `src/lib/transferAt.ts:buildTransferAt`.

Historically the two writers disagreed on what the column actually
stored. Worker stored UTC (intent), while `buildTransferAt` emitted a
naive Bangkok-local string `"YYYY-MM-DD HH:MM:SS"` and let the DB
session timezone interpret it. Every query that filtered by Bangkok
date papered over the mismatch with a `+ INTERVAL '7 hours'` hack that
happened to work for worker rows but silently shifted manual rows.

A separate worker bug (`ccaa73c`) used `targetDate` (a JS `Date` object
returned by pg for `date` columns) inside a template literal, producing
an unparseable string and leaving fresh `transfer_at` values either
incorrect or null. Fixing that bug exposed the convention drift.

A second null-transfer_at bug was discovered 2026-05-29: `bot.js` enqueued
`upload.target_date` (a pg `Date` object) directly into BullMQ. BullMQ
serialises job data via `JSON.stringify`, converting the `Date` to an ISO
timestamp string (`"2026-05-28T17:00:00.000Z"`). When `worker.js` received
the job, `targetDate` was a string, so the `instanceof Date` guard was always
false, and `targetDateStr` was set to the raw ISO string. The resulting
`bangkokStr` (`"2026-05-28T17:00:00.000ZT14:30:00+07:00"`) was unparseable,
leaving `transfer_at = null` for every worker-processed row. Fix: normalise
`target_date → YYYY-MM-DD` in `bot.js` before `slipQueue.add()` so the worker
always receives a clean date string regardless of serialisation.

## Decision

Both write paths store **UTC** instants in `transfer_at`. The column type
remains `timestamp without time zone` — the value is an instant whose
timezone is UTC by convention, not by column metadata.

- **worker write** receives `targetDate` as a plain `YYYY-MM-DD` string
  (normalised by `bot.js` before enqueue to survive BullMQ JSON round-trip),
  then `${date}T${time}:00+07:00` → `Date.toISOString()`.
- **manual write** runs the same conversion in `buildTransferAt(date, time)`
  in TypeScript: input is Bangkok-local strings; output is a UTC ISO
  string. The DB receives an ISO with `Z` and stores it as the UTC
  instant.
- **Reads that filter by Bangkok date** use
  `(transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date`.
  The previous `+ INTERVAL '7 hours'` hack is removed everywhere; the
  AT TIME ZONE form is explicit about both directions of the conversion
  and will not silently break if the DB session tz is ever changed.

## Consequences

- `transactions.transfer_at` for all 3148 historical rows was rewritten
  from `raw_uploads.target_date` + `raw_ai_output.time` (Bangkok →
  UTC), joined by `image_path`. Prior values were snapshotted to a
  backup table before the migration.
- Where staff had overridden `transfer_at` via the UI fallback for
  slips whose AI time was wrong, the backfill restored the AI time.
  `raw_ai_output` itself was not modified, so the audit trail is
  intact. Re-applying staff overrides from the backup table is the
  responsibility of any future cleanup pass.
- Query authors must use the AT TIME ZONE form for Bangkok-date
  filters. Linting for `+ INTERVAL '7 hours'` against `transfer_at`
  prevents regressions.
- pg-node OID 1114 parser is configured in `src/lib/db.ts` to parse the
  column as UTC, so JS `Date` instances on read line up with the
  stored instant rather than being interpreted in the process tz.
