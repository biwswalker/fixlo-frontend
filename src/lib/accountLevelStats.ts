import type { AccountLevelStat } from "@/actions/reconciliation";

export interface TxRow {
  account_name: string | null;
  ai_amount: number | string | null;
  adjusted_amount?: number | string | null;
  account_id?: string | null;
  bank_code?: string | null;
  account_number?: string | null;
}

export interface ClosingBalRow {
  account_name: string | null;
  closing_balance: number | string | null;
}

export interface ManualTxRow {
  account_name: string | null;
  amount: number | string | null;
}

type AccountEntry = {
  systemOutflow: number;
  manualOutflow: number;
  count: number;
  closingBalance: number | null;
  accountId: string | null;
  bankCode: string | null;
  accountNumber: string | null;
};

/**
 * Pure aggregation: merges DB result rows for transactions, closing balances,
 * and manual transactions into AccountLevelStat[].
 *
 * systemOutflow uses COALESCE(adjusted_amount, ai_amount) per row so that
 * admin corrections are reflected without losing the original ai_amount audit trail.
 *
 * Accounts with a closing balance snapshot but no transactions still appear
 * so that admins notice accounts with closingBalance but zero outflow.
 */
export function buildAccountLevelStats(
  txRows: TxRow[],
  closingBalRows: ClosingBalRow[],
  manualTxRows: ManualTxRow[] = [],
): AccountLevelStat[] {
  const accountMap = new Map<string, AccountEntry>();

  for (const row of txRows) {
    const name = row.account_name || "Unmapped";
    const amount = Number(row.adjusted_amount ?? row.ai_amount ?? 0);
    const existing = accountMap.get(name);
    if (existing) {
      existing.systemOutflow += amount;
      existing.count += 1;
    } else {
      accountMap.set(name, {
        systemOutflow: amount,
        manualOutflow: 0,
        count: 1,
        closingBalance: null,
        accountId: row.account_id ?? null,
        bankCode: row.bank_code ?? null,
        accountNumber: row.account_number ?? null,
      });
    }
  }

  for (const row of manualTxRows) {
    const name = row.account_name || "Unmapped";
    const amount = Number(row.amount ?? 0);
    const existing = accountMap.get(name);
    if (existing) {
      existing.manualOutflow += amount;
    } else {
      accountMap.set(name, {
        systemOutflow: 0,
        manualOutflow: amount,
        count: 0,
        closingBalance: null,
        accountId: null,
        bankCode: null,
        accountNumber: null,
      });
    }
  }

  for (const row of closingBalRows) {
    const name = row.account_name || "Unmapped";
    const closingBalance = row.closing_balance !== null && row.closing_balance !== undefined
      ? Number(row.closing_balance)
      : null;
    const existing = accountMap.get(name);
    if (existing) {
      existing.closingBalance = closingBalance;
    } else {
      accountMap.set(name, {
        systemOutflow: 0,
        manualOutflow: 0,
        count: 0,
        closingBalance,
        accountId: null,
        bankCode: null,
        accountNumber: null,
      });
    }
  }

  return Array.from(accountMap.entries())
    .map(([account, { systemOutflow, manualOutflow, count, closingBalance, accountId, bankCode, accountNumber }]) => ({
      account,
      accountId,
      bankCode,
      accountNumber,
      systemOutflow,
      manualOutflow,
      adjustments: 0,
      effectiveOutflow: systemOutflow + manualOutflow,
      count,
      closingBalance,
    }))
    .sort((a, b) => b.effectiveOutflow - a.effectiveOutflow);
}
