export interface DayTotalRow {
  day_date: string;
  total: string | number;
}

export interface ChartPoint {
  day: string;
  deposits: number;
  withdrawals: number;
  netDiff: number;
  date: string;
}

/**
 * Merges per-day deposit and withdrawal rows into chart data points.
 *
 * Both input arrays contain rows from report_deposits / report_withdrawals
 * grouped by trans_date::date. Dates present in only one set get zero for
 * the missing side.
 */
export function mergeDailyChartRows(
  depositRows: DayTotalRow[],
  withdrawalRows: DayTotalRow[],
): ChartPoint[] {
  const depositsByDay = new Map<string, number>();
  for (const row of depositRows) {
    depositsByDay.set(row.day_date, Number(row.total));
  }

  const withdrawalsByDay = new Map<string, number>();
  for (const row of withdrawalRows) {
    withdrawalsByDay.set(row.day_date, Number(row.total));
  }

  const allDates = Array.from(
    new Set([...depositsByDay.keys(), ...withdrawalsByDay.keys()]),
  ).sort();

  return allDates.map((date) => {
    const deposits = depositsByDay.get(date) ?? 0;
    const withdrawals = withdrawalsByDay.get(date) ?? 0;
    const d = new Date(date);
    return {
      day: isNaN(d.getTime())
        ? "N/A"
        : new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d),
      deposits,
      withdrawals,
      netDiff: deposits - withdrawals,
      date,
    };
  });
}
