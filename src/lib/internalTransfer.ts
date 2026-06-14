export interface InternalTransferRow {
  /** Receiving master account id (project_accounts.id), UUID text */
  receiving_account_id: string;
  date: string;
  amount: number | string;
}

/**
 * Aggregates internal-transfer inflows into per-account, per-day totals for
 * the ยอดรับ carve-out (ADR 0020 §1).
 *
 * An internal transfer is an outgoing slip whose receiver 2-tier-matched a
 * master account (detected at query time). The receiving account's ยอดรับ is
 * inflated by the amount because the balance rises with no slip of its own.
 *
 * Returns Map<accountId, Map<date, internalIn>>.
 */
export function aggregateInternalTransferByAccountDay(
  rows: InternalTransferRow[],
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    const dayMap = result.get(row.receiving_account_id) ?? new Map<string, number>();
    dayMap.set(row.date, (dayMap.get(row.date) ?? 0) + amount);
    result.set(row.receiving_account_id, dayMap);
  }
  return result;
}
