---
id: "0004"
title: Canonical deposit/withdraw KPI uses source tables, not report_summary_daily
status: accepted
date: 2026-05-15
tags: [kpi, dashboard, reconciliation, schema]
---

## Context

`CONTEXT.md` item 8 previously defined the canonical KPI as:

- **ยอดฝากรวม** = `deposit + manual_in + bonus + fixed_deposit` (aggregate from `report_summary_daily`)
- **ยอดถอนรวม** = `withdraw + manual_out + redeem + affiliate + cashback` (aggregate from `report_summary_daily`)

This produced two problems:

1. **KPI distortion** — Bonus (free promo credit), fixed_deposit, redeem, affiliate, and cashback are not real cash inflows/outflows. Including them in the headline numbers makes the dashboard misrepresent actual cash movement.
2. **Reconciliation distortion** — The `expectedInflow` on the Reconciliation page used the same aggregate, so bonus inflated "ยอดรับเข้าระบบ" and masked genuine variance vs the bank balance.

Additionally, the formula was duplicated in three places (`getDashboardSummary`, `getDailyChartData`, `getReconciliationReport`), creating drift risk whenever the definition needed to change.

## Decision

The canonical KPI formulas are:

- **ยอดฝากรวม** = `SUM(report_deposits.amount WHERE status='สำเร็จ')` + `SUM(report_manual_credit_in.amount)`
- **ยอดถอนรวม** = `SUM(report_withdrawals.amount WHERE status='สำเร็จ')` + `SUM(report_manual_credit_out.amount)`

A single lib module (`src/lib/kpiSql.ts`) exposes four pure SQL-builder helpers:

- `depositTotalSql(startParam, endParam)` — scalar total for deposits
- `withdrawTotalSql(startParam, endParam)` — scalar total for withdrawals
- `depositPerDaySql(startParam, endParam)` — per-day deposit series
- `withdrawPerDaySql(startParam, endParam)` — per-day withdrawal series

All three consumers (`getDashboardSummary`, `getDailyChartData`, `getReconciliationReport`) replace inline SQL with calls to this lib. The `status = 'สำเร็จ'` filter is hard-coded inside the helpers and is not a caller parameter.

`latestBalance` / "ยอดคงเหลือล่าสุด" continues to read `report_summary_daily.balance` — this is actual bank balance from the scraper and is unrelated to KPI computation.

## Consequences

- Variance numbers in Reconciliation will shift for any past day that had bonus inflow — intentional. Stakeholders seeing historical variance shifts should be pointed here.
- Bonus, fixed_deposit, redeem, affiliate, cashback data continue to exist in `report_summary_daily`; they are simply no longer surfaced as KPIs.
- When multi-tenant rollout adds `project_id` filtering to `report_*` tables, the lib is the single place to add that parameter. All consumers inherit the change automatically.
- Snapshot tests in `src/lib/__tests__/kpiSql.test.ts` guard against regressions that re-introduce bonus or remove the status filter.

## Alternatives considered

- **Keep `report_summary_daily` aggregate** — rejected; includes non-cash components (bonus, redeem, affiliate, cashback) that distort real cash movement KPIs.
- **Add a separate "verified inflow" card sourced from `daily_balances` LAG formula** — rejected; that is a different concept (bank-side inflow reconstruction) and out of scope for this change.
