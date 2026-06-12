export interface ParkingRow {
  project_account_id: string | null;
  account_name?: string | null;
  account_number?: string | null;
  date: string;
  amount: number | string | null;
  status: string | null;
}

export interface UnregisteredParking {
  accountName: string;
  accountNumber: string;
  amount: number;
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

/**
 * Groups Approved parking that landed in an UNregistered account (FK null) by
 * account, summing the amount (ADR 0018 §4). Used for the reconciliation banner
 * that lists each unregistered destination + how much arrived, so an admin can
 * register it. Insertion order is preserved (first-seen account first).
 */
export function aggregateUnregisteredParking(rows: ParkingRow[]): UnregisteredParking[] {
  const byAccount = new Map<string, UnregisteredParking>();
  for (const row of rows) {
    if (row.status !== "Approved") continue;
    if (row.project_account_id != null) continue;
    const accountName = row.account_name ?? "";
    const accountNumber = row.account_number ?? "";
    const key = `${accountName}::${accountNumber}`;
    const amount = Number(row.amount ?? 0);
    const existing = byAccount.get(key);
    if (existing) existing.amount += amount;
    else byAccount.set(key, { accountName, accountNumber, amount });
  }
  return Array.from(byAccount.values());
}
