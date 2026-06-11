export interface ParkingRow {
  project_account_id: string | null;
  date: string;
  amount: number | string | null;
  status: string | null;
}

/**
 * Aggregates gateway parking withdrawals (ADR 0018) into per-account, per-day
 * totals for the reconciliation carve-out:
 *
 *   parking_in_D(account) = Σ amount  WHERE status='Approved'
 *
 * Only Approved rows count (Pending/Rejected never reached the bank, so the
 * balance never moved). `amount` is the net received (request − refund) — what
 * actually inflated the master's balance. Rows are pre-bucketed by Bangkok date
 * and project_account_id by the SQL query; FK-null rows (parking into an
 * unregistered account) are skipped — they never inflate a tracked balance.
 *
 * Returns Map<accountId, Map<date, parkingIn>>.
 */
export function aggregateParkingByAccountDay(
  rows: ParkingRow[],
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.status !== "Approved") continue;
    if (row.project_account_id == null) continue;
    const amount = Number(row.amount ?? 0);
    const dayMap = result.get(row.project_account_id) ?? new Map<string, number>();
    dayMap.set(row.date, (dayMap.get(row.date) ?? 0) + amount);
    result.set(row.project_account_id, dayMap);
  }
  return result;
}
