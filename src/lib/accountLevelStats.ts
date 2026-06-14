import type { AccountLevelStat } from "@/actions/reconciliation";
import type { ParsedApayAccountReport } from "@/lib/apayStats";

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

export interface DayBalanceRow {
  account_name: string | null;
  balance_amount: number | string | null;
  matching_status?: string;
  image_path?: string;
  id?: number | string | null;
  source?: string | null;
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
  selectedBalRows: DayBalanceRow[] = [],
  prevBalRows: DayBalanceRow[] = [],
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

  const selectedBalMap = new Map<string, number | null>();
  const selectedStatusMap = new Map<string, string | null>();
  const selectedImageMap = new Map<string, string | null>();
  const selectedIdMap = new Map<string, number | null>();
  const selectedSourceMap = new Map<string, string | null>();
  for (const row of selectedBalRows) {
    const name = row.account_name || "Unmapped";
    selectedBalMap.set(name, row.balance_amount !== null && row.balance_amount !== undefined
      ? Number(row.balance_amount)
      : null);
    selectedStatusMap.set(name, row.matching_status ?? null);
    selectedImageMap.set(name, row.image_path ?? null);
    selectedIdMap.set(name, row.id != null ? Number(row.id) : null);
    selectedSourceMap.set(name, row.source ?? null);
  }

  const prevBalMap = new Map<string, number | null>();
  const prevStatusMap = new Map<string, string | null>();
  const prevImageMap = new Map<string, string | null>();
  const prevIdMap = new Map<string, number | null>();
  const prevSourceMap = new Map<string, string | null>();
  for (const row of prevBalRows) {
    const name = row.account_name || "Unmapped";
    prevBalMap.set(name, row.balance_amount !== null && row.balance_amount !== undefined
      ? Number(row.balance_amount)
      : null);
    prevStatusMap.set(name, row.matching_status ?? null);
    prevImageMap.set(name, row.image_path ?? null);
    prevIdMap.set(name, row.id != null ? Number(row.id) : null);
    prevSourceMap.set(name, row.source ?? null);
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
      selectedDayBalance: selectedBalMap.get(account) ?? null,
      prevDayBalance: prevBalMap.get(account) ?? null,
      selectedDayStatus: selectedStatusMap.get(account) ?? null,
      prevDayStatus: prevStatusMap.get(account) ?? null,
      selectedDayImagePath: selectedImageMap.get(account) ?? null,
      prevDayImagePath: prevImageMap.get(account) ?? null,
      selectedDayBalanceId: selectedIdMap.get(account) ?? null,
      prevDayBalanceId: prevIdMap.get(account) ?? null,
      selectedDaySource: selectedSourceMap.get(account) ?? null,
      prevDaySource: prevSourceMap.get(account) ?? null,
      reportSourced: false,
      reportSource: null,
      gatewayInflow: null,
      gatewayOutflow: null,
      parkingIn: 0,
      internalIn: 0,
      typeBreakdown: [],
    }))
    .sort((a, b) => b.effectiveOutflow - a.effectiveOutflow);
}

/**
 * Merges the Apay gateway report (ADR 0016) into the stats list in place.
 *
 * The Apay row's outflow/inflow become report-sourced (Replace semantics):
 * effectiveOutflow = withdrawal, ยอดรับ = deposit. Slip/manual columns are
 * zeroed (gateway is neither). Balance snapshots are preserved as display-only.
 * When no report row exists that day, gatewayInflow/gatewayOutflow stay null so
 * the row renders "—/ไม่มีรายงาน" without falling back to the balance formula.
 *
 * The Apay row is located by accountId (NOT account_name: gateways like
 * Apay/Badoo/DPay can share a name such as "ACCTEAM", so a name match could
 * clobber a different gateway's row). If absent it is injected so the gateway
 * always shows for single-project views. Balance snapshots come from an existing
 * row when present, else from `balance` (the Apay daily_balances rows) — needed
 * because balance-only accounts never get a row from buildAccountLevelStats.
 * Re-sorts by effectiveOutflow.
 */
export type ApayBalanceSnapshot = Pick<
  AccountLevelStat,
  | "selectedDayBalance" | "prevDayBalance"
  | "selectedDayStatus" | "prevDayStatus"
  | "selectedDayImagePath" | "prevDayImagePath"
  | "selectedDayBalanceId" | "prevDayBalanceId"
  | "selectedDaySource" | "prevDaySource"
>;

export function applyApayReportOverride(
  stats: AccountLevelStat[],
  report: ParsedApayAccountReport,
  balance?: ApayBalanceSnapshot | null,
): void {
  const idx = stats.findIndex((s) => s.accountId === report.accountId);
  const base = idx >= 0 ? stats[idx] : null;
  const bal = base ?? balance ?? null;

  const merged: AccountLevelStat = {
    account: report.accountName,
    accountId: report.accountId,
    bankCode: report.bankCode,
    accountNumber: base?.accountNumber ?? null,
    systemOutflow: 0,
    manualOutflow: 0,
    adjustments: 0,
    effectiveOutflow: report.gatewayOutflow ?? 0,
    count: 0,
    closingBalance: base?.closingBalance ?? null,
    selectedDayBalance: bal?.selectedDayBalance ?? null,
    prevDayBalance: bal?.prevDayBalance ?? null,
    selectedDayStatus: bal?.selectedDayStatus ?? null,
    prevDayStatus: bal?.prevDayStatus ?? null,
    selectedDayImagePath: bal?.selectedDayImagePath ?? null,
    prevDayImagePath: bal?.prevDayImagePath ?? null,
    selectedDayBalanceId: bal?.selectedDayBalanceId ?? null,
    prevDayBalanceId: bal?.prevDayBalanceId ?? null,
    selectedDaySource: bal?.selectedDaySource ?? null,
    prevDaySource: bal?.prevDaySource ?? null,
    reportSourced: true,
    reportSource: report.reportSource,
    gatewayInflow: report.gatewayInflow,
    gatewayOutflow: report.gatewayOutflow,
    parkingIn: 0,
    internalIn: 0, // gateway rows are never carved (reportSourced ignores carve-outs)
    typeBreakdown: [],
  };

  if (idx >= 0) stats[idx] = merged;
  else stats.push(merged);

  stats.sort((a, b) => b.effectiveOutflow - a.effectiveOutflow);
}
