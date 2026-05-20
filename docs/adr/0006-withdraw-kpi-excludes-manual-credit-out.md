---
id: "0006"
title: Withdraw KPI excludes report_manual_credit_out
status: accepted
date: 2026-05-20
tags: [kpi, dashboard, withdraw]
---

## Context

ADR 0004 defined **ยอดถอนรวม** as `report_withdrawals (status='สำเร็จ') + report_manual_credit_out`. After reviewing what `report_manual_credit_out` actually represents, this formulation was found to be incorrect.

`report_manual_credit_out` = a game-system credit adjustment made by staff on the web platform (หักเครดิตด้วยมือ). It does not represent money leaving the master bank account — no real cash outflow occurs. Including it inflates the "ยอดถอนรวม" KPI and misrepresents actual cash movement.

## Decision

**ยอดถอนรวม** = `SUM(report_withdrawals.amount WHERE status='สำเร็จ')` only.

`report_manual_credit_out` continues to be displayed as a separate line item ("ถอนมือ (Manual Out)") in the "รายละเอียดรายรับ-รายจ่าย" breakdown section, so operators can still see it — it is simply not part of the headline cash KPI.

This change applies to both the KPI card (`withdrawTotalSql`) and the cashflow chart (`withdrawPerDaySql`), since both should reflect the same definition of cash withdrawal.

## Consequences

- Historical "ยอดถอนรวม" values on the dashboard will shift downward by whatever `report_manual_credit_out` contributed. This is intentional and correct.
- `report_manual_credit_out` data is not lost — it remains visible in the breakdown table.
- `src/lib/kpiSql.ts` is the single place to maintain this definition. ADR 0004's placement decision (single lib module) remains unchanged.

## Alternatives considered

- **Keep manual_credit_out in the KPI** — rejected; it is a game-side adjustment, not a cash outflow. Including it misrepresents the master account cash position.
- **Create a separate KPI card for game adjustments** — out of scope; the breakdown table already serves this purpose.
