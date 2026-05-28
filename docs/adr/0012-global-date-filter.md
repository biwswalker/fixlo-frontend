---
id: "0012"
title: Global date filter with per-page period state
status: accepted
date: 2026-05-28
tags: [ui, state, routing, reconciliation, match, dashboard]
---

# ADR 0012 — Global date, per-page period

## Context

Reconciliation, match, and dashboard pages all filter by a date. Each
page previously owned its own date control, and users complained about
re-picking the same date after every navigation. A "rolling time
period" (day / week / month / year) is also desired on dashboard and
match — but reconciliation is defined as day-only ([CONTEXT.md
"Reconciliation day-only"]).

Two independent axes of state:

1. **Anchor date** — what point in time the user is looking at.
   Naturally global: when the admin walks from reconciliation →
   match → dashboard while investigating yesterday, the date should
   follow.
2. **Period (day/week/month/year)** — page-specific lens on that
   anchor. Reconciliation has no period choice. Match and dashboard
   may legitimately want different defaults (match defaults to "day"
   to triage today's backlog; dashboard may default to "month" for KPI).

## Decision

**Date** is global, stored in the URL query (`?date=YYYY-MM-DD`) and
mirrored to `sessionStorage` for cross-page persistence within a
session:

- URL query is the source of truth on a given page render. It is
  bookmarkable and shareable.
- `sessionStorage` carries the value to the next page when the user
  navigates via in-app links that don't preserve query. The next page
  reads `sessionStorage` if the URL has no `?date=`.
- On a fresh session (no URL, no sessionStorage), default is
  **yesterday** (Bangkok). Scraper runs 00:30 dumping yesterday, so
  yesterday is the first day with complete data.
- Closing the browser drops the choice; the next session starts at
  yesterday again. This avoids stale-date confusion across days.

**Period** is per-page, stored in `localStorage` keyed by page
(`fixlo.period.match`, `fixlo.period.dashboard`). Reconciliation has
no period state at all — the page is day-only by construction and the
period selector is hidden, not disabled.

**Period range** is anchor-relative:

- `day` → `date`
- `week` → ISO Monday–Sunday containing `date`
- `month` → calendar month containing `date`
- `year` → calendar year containing `date`

**Component shape:**

- `<GlobalDateBar />` is a client component that pages opt into by
  mounting it (currently: reconciliation, match, dashboard root). It
  renders the date picker and, if `showPeriod` prop is set, the
  period selector. It owns the URL/sessionStorage/localStorage
  plumbing.
- The site header (`src/components/layout/Header.tsx`) is untouched —
  it carries the project switcher, not the date. Pages without a
  date filter (accounts, settings) simply don't mount
  `<GlobalDateBar />`.

## Consequences

- Two persistence layers (URL + sessionStorage for date, localStorage
  for period) — readers must look in the right place. The
  `<GlobalDateBar />` component encapsulates the precedence so callers
  don't see it.
- The header stays slim; pages that grow new date-aware tabs in
  future must mount `<GlobalDateBar />` explicitly (no implicit
  global side effects).
- "Shareable URL" only covers date, not period. Sharing a dashboard
  URL with the intent "look at this month" requires copying the
  recipient's period explicitly or encoding period in the URL as
  well — the latter was rejected to keep period a private
  preference, not a navigational coordinate.
- Reconciliation's day-only nature is enforced by omission, not by a
  disabled control. A developer adding `showPeriod` to reconciliation
  by mistake would surface period semantics into a page that has
  none — code review must catch it.
