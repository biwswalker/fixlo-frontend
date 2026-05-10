export interface ReportSummaryRow {
  report_date: string;
  project_id: string;
  deposit: number | null;
  manual_in: number | null;
  bonus: number | null;
  fixed_deposit: number | null;
  withdraw: number | null;
  manual_out: number | null;
  redeem: number | null;
  affiliate: number | null;
  cashback: number | null;
  balance: number | null;
}

export interface KpiResult {
  deposits: number;
  withdrawals: number;
  balance: number;
  byDay: { date: string; deposits: number; withdrawals: number; netDiff: number }[];
}

function n(v: number | null | undefined): number {
  return Number(v ?? 0);
}

/**
 * Canonical KPI aggregation for report_summary_daily rows.
 *
 * deposits    = deposit + manual_in + bonus + fixed_deposit
 * withdrawals = withdraw + manual_out + redeem + affiliate + cashback
 * balance     = latest report_summary_daily.balance snapshot
 */
export function computeKpi(rows: ReportSummaryRow[], projectId?: string): KpiResult {
  const filtered = projectId ? rows.filter((r) => r.project_id === projectId) : rows;

  if (filtered.length === 0) {
    return { deposits: 0, withdrawals: 0, balance: 0, byDay: [] };
  }

  let totalDeposits = 0;
  let totalWithdrawals = 0;

  const byDayMap = new Map<string, { deposits: number; withdrawals: number }>();

  for (const row of filtered) {
    const dep = n(row.deposit) + n(row.manual_in) + n(row.bonus) + n(row.fixed_deposit);
    const wdl = n(row.withdraw) + n(row.manual_out) + n(row.redeem) + n(row.affiliate) + n(row.cashback);
    totalDeposits += dep;
    totalWithdrawals += wdl;

    const day = row.report_date.toString().slice(0, 10);
    const existing = byDayMap.get(day);
    if (existing) {
      existing.deposits += dep;
      existing.withdrawals += wdl;
    } else {
      byDayMap.set(day, { deposits: dep, withdrawals: wdl });
    }
  }

  // Latest balance = row with max report_date
  const sorted = [...filtered].sort((a, b) =>
    a.report_date.toString().localeCompare(b.report_date.toString()),
  );
  const balance = n(sorted[sorted.length - 1].balance);

  const byDay = Array.from(byDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { deposits, withdrawals }]) => ({
      date,
      deposits,
      withdrawals,
      netDiff: deposits - withdrawals,
    }));

  return { deposits: totalDeposits, withdrawals: totalWithdrawals, balance, byDay };
}
