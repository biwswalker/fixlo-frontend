export interface OutflowTypeRow {
  type_name: string | null;
  effective_amount: number;
}

export interface OutflowByTypeSummary {
  typeName: string;
  total: number;
}

const UNTYPED_LABEL = "ไม่ระบุ";

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
