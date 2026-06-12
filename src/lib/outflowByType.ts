export interface OutflowTypeRow {
  type_name: string | null;
  effective_amount: number;
}

export interface OutflowTypeAccountRow extends OutflowTypeRow {
  account_id: string | null;
}

export interface OutflowByTypeSummary {
  typeName: string;
  total: number;
}

const UNTYPED_LABEL = "ไม่ระบุ";

/**
 * Groups rows by account_id, then within each account by type (null → "ไม่ระบุ").
 * Rows with null account_id are skipped. Returns Map<accountId, summary[]>.
 */
export function groupOutflowByAccount(
  rows: OutflowTypeAccountRow[],
): Map<string, OutflowByTypeSummary[]> {
  const byAccount = new Map<string, OutflowTypeRow[]>();
  for (const row of rows) {
    if (row.account_id == null) continue;
    const bucket = byAccount.get(row.account_id) ?? [];
    bucket.push({ type_name: row.type_name, effective_amount: row.effective_amount });
    byAccount.set(row.account_id, bucket);
  }
  const result = new Map<string, OutflowByTypeSummary[]>();
  for (const [accountId, accountRows] of byAccount) {
    result.set(accountId, aggregateOutflowByType(accountRows));
  }
  return result;
}

/**
 * Groups raw transaction rows by type name and sums effective outflow.
 * Null type_name is bucketed as "ไม่ระบุ". Result sorted by total descending.
 */
export function aggregateOutflowByType(rows: OutflowTypeRow[]): OutflowByTypeSummary[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.type_name ?? UNTYPED_LABEL;
    totals.set(key, (totals.get(key) ?? 0) + Number(row.effective_amount));
  }
  return [...totals.entries()]
    .map(([typeName, total]) => ({ typeName, total }))
    .sort((a, b) => b.total - a.total);
}
