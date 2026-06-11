export interface PerAccountInflowResult {
  value: number | null;
  missingMessage: string | null;
}

/**
 * Computes ยอดรับ (player-only) for a single master account on a given day.
 * Formula: (balance_D − balance_(D-1)) + effectiveOutflow_D − parkingIn_D
 * Returns a missing-data message when either balance snapshot is absent.
 *
 * parkingIn carves out gateway "parking" sweeps (ADR 0018) that already counted
 * once as an Apay deposit and would otherwise double-count via the balance delta.
 * The result is not floored: a negative value (parking exceeds the observed
 * balance delta) is surfaced as a data/timing discrepancy.
 */
export function computePerAccountInflow(
  selectedDayBalance: number | null,
  prevDayBalance: number | null,
  effectiveOutflow: number,
  parkingIn: number = 0,
): PerAccountInflowResult {
  if (selectedDayBalance === null && prevDayBalance === null) {
    return { value: null, missingMessage: "ไม่มียอดคงเหลือทั้งสองวัน" };
  }
  if (selectedDayBalance === null) {
    return { value: null, missingMessage: "ไม่มียอดคงเหลือวันที่เลือก" };
  }
  if (prevDayBalance === null) {
    return { value: null, missingMessage: "ไม่มียอดคงเหลือวันก่อนหน้า" };
  }
  return {
    value: (selectedDayBalance - prevDayBalance) + effectiveOutflow - parkingIn,
    missingMessage: null,
  };
}

/**
 * Resolves ยอดรับ for an account row, honouring the Apay gateway override (ADR 0016).
 * Report-sourced rows use gatewayInflow directly (no balance formula); a null
 * gatewayInflow means no report row that day → "ไม่มีรายงาน".
 */
export function resolveAccountInflow(stat: {
  reportSourced: boolean;
  gatewayInflow: number | null;
  selectedDayBalance: number | null;
  prevDayBalance: number | null;
  effectiveOutflow: number;
  parkingIn?: number;
}): PerAccountInflowResult {
  if (stat.reportSourced) {
    // Apay rows use the gateway report directly — never the balance formula, so
    // parkingIn does not apply (parked money is counted once at the Apay deposit).
    return stat.gatewayInflow !== null
      ? { value: stat.gatewayInflow, missingMessage: null }
      : { value: null, missingMessage: "ไม่มีรายงาน" };
  }
  return computePerAccountInflow(
    stat.selectedDayBalance,
    stat.prevDayBalance,
    stat.effectiveOutflow,
    stat.parkingIn ?? 0,
  );
}

export interface BalanceRow {
  project_account_id: string;
  date: string;
  balance_amount: number;
}

export interface TxOutflow {
  project_account_id: string;
  date: string;
  total_outflow: number;
}

/**
 * Computes per-account, per-day inflow using the LAG formula:
 *   inflow_D = balance_D − balance_(D-1) + withdrawals_D
 *
 * Returns Map<accountId, Map<date, inflow | null>>.
 * null means no prior balance row exists (first snapshot ever for that account).
 */
export function computeInflow(
  balanceRows: BalanceRow[],
  outflows: TxOutflow[],
): Map<string, Map<string, number | null>> {
  // Group balances by account, sorted by date ascending
  const byAccount = new Map<string, BalanceRow[]>();
  for (const row of balanceRows) {
    const list = byAccount.get(row.project_account_id) ?? [];
    list.push(row);
    byAccount.set(row.project_account_id, list);
  }
  for (const list of byAccount.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Build outflow lookup: accountId+date → total_outflow
  const outflowMap = new Map<string, number>();
  for (const o of outflows) {
    const key = `${o.project_account_id}::${o.date}`;
    outflowMap.set(key, (outflowMap.get(key) ?? 0) + o.total_outflow);
  }

  const result = new Map<string, Map<string, number | null>>();

  for (const [accountId, rows] of byAccount.entries()) {
    const dayMap = new Map<string, number | null>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i === 0) {
        // No prior row → inflow unknown
        dayMap.set(row.date, null);
        continue;
      }
      const prev = rows[i - 1];
      const outflow = outflowMap.get(`${accountId}::${row.date}`) ?? 0;
      const inflow = row.balance_amount - prev.balance_amount + outflow;
      dayMap.set(row.date, inflow);
    }
    result.set(accountId, dayMap);
  }

  return result;
}
