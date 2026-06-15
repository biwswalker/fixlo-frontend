"use server";

import { query } from "@/lib/db";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { getServerAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { resolveProject } from "@/lib/projects";
import { resolvePeriodToDateRange } from "@/lib/periodUtils";
import { buildAccountLevelStats, applyApayReportOverride } from "@/lib/accountLevelStats";
import { resolveAccountInflow } from "@/lib/inflowFormula";
import { aggregateParkingByAccountDay, aggregateUnregisteredParking, type UnregisteredParking } from "@/lib/parkingStats";
import { aggregateOutflowByType, groupOutflowByAccount, type OutflowByTypeSummary } from "@/lib/outflowByType";
import { aggregateInternalTransferByAccountDay } from "@/lib/internalTransfer";
import { computeCrossProjectOutflow, type CrossProjectOutflowGroup } from "@/lib/crossProjectOutflow";
import { depositTotalSql } from "@/lib/kpiSql";
import { buildApayAccountReportQuery, parseApayAccountReportRow } from "@/lib/apayStats";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountLevelStat {
  /** Master account name */
  account: string;
  /** UUID of the project_account; null for "Unmapped" */
  accountId: string | null;
  /** Bank code (e.g. 'scb', 'kbank'); null for "Unmapped" */
  bankCode: string | null;
  /** Raw account number from project_accounts; null if absent or "Unmapped" */
  accountNumber: string | null;
  /** OCR-verified outflow amount for this account */
  systemOutflow: number;
  /** Outflow from manually-entered transactions (manual_transactions table) */
  manualOutflow: number;
  /** Always 0 — kept for type compatibility; adjustments are now per-slip via adjusted_amount */
  adjustments: number;
  /** systemOutflow + manualOutflow */
  effectiveOutflow: number;
  /** Number of system transactions */
  count: number;
  /** Most recent matched daily_balance for this account within the period; null = no snapshot */
  closingBalance: number | null;
  /** Balance from daily_balances where date = selected date exactly; null = no strict-match row */
  selectedDayBalance: number | null;
  /** Balance from daily_balances where date = selected date − 1 day exactly; null = no strict-match row */
  prevDayBalance: number | null;
  /** Matching status of daily_balance for selected date; null if no balance for that date */
  selectedDayStatus: string | null;
  /** Matching status of daily_balance for previous day; null if no balance for that date */
  prevDayStatus: string | null;
  /** Image path of daily_balance for selected date; null if no balance or no image */
  selectedDayImagePath: string | null;
  /** Image path of daily_balance for previous day; null if no balance or no image */
  prevDayImagePath: string | null;
  /** DB id of daily_balance for selected date; null if no balance */
  selectedDayBalanceId: number | null;
  /** DB id of daily_balance for previous day; null if no balance */
  prevDayBalanceId: number | null;
  /** Source of daily_balance for selected date (discord/scraper/manual); null if none */
  selectedDaySource: string | null;
  /** Source of daily_balance for previous day; null if none */
  prevDaySource: string | null;
  /** True when outflow/inflow come from report_apay_daily instead of slips/balance (ADR 0016) */
  reportSourced: boolean;
  /** Gateway report source; null when reportSourced=false or no report row that day */
  reportSource: "scraper" | "discord" | null;
  /** Gateway deposit → ยอดรับ for reportSourced rows; null = no report row */
  gatewayInflow: number | null;
  /** Gateway withdrawal → effectiveOutflow for reportSourced rows; null = no report row */
  gatewayOutflow: number | null;
  /** Approved parking swept into this account on the selected day (ADR 0018), carved out of ยอดรับ; 0 when none */
  parkingIn: number;
  /** Internal-transfer inflow into this account on the selected day (ADR 0020 §1), carved out of ยอดรับ; 0 when none */
  internalIn: number;
  /** Per-type outflow breakdown for this account (ADR 0019 phase 1, display-only) */
  typeBreakdown: OutflowByTypeSummary[];
}

export interface ReconciliationReport {
  startingBalance: number;
  expectedInflow: number;
  adjustmentsTotal: number;
  effectiveOutflowTotal: number;
  actualBalance: number;
  expectedBalance: number;
  variance: number;
  accountLevelStats: AccountLevelStat[];
  periodStart: string;
  periodEnd: string;
  /** Alias of actualBalance — useful for single-day status view */
  todayBalance: number;
  /** Alias of startingBalance — the balance just before the period */
  yesterdayBalance: number;
  /** Sum of ยอดรับ per account (accounts missing balance data are excluded) */
  slipInflow: number;
  /** Approved parking (ADR 0018) for the day that landed in unregistered accounts (FK null), per account; display-only */
  unregisteredParking: UnregisteredParking[];
  /** Per-type outflow totals for the selected day (ADR 0019 phase 1, display-only) */
  outflowByType: OutflowByTypeSummary[];
  /** Cross-project outflow breakdown for the selected day (ADR 0020 §5, display-only) */
  crossProjectOutflow: CrossProjectOutflowGroup[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------




/** Empty report used as a safe fallback on errors or unresolvable projects. */
function emptyReport(startDate: string, endDate: string): ReconciliationReport {
  return {
    startingBalance: 0,
    expectedInflow: 0,
    adjustmentsTotal: 0,
    effectiveOutflowTotal: 0,
    actualBalance: 0,
    expectedBalance: 0,
    variance: 0,
    accountLevelStats: [],
    periodStart: startDate,
    periodEnd: endDate,
    todayBalance: 0,
    yesterdayBalance: 0,
    slipInflow: 0,
    unregisteredParking: [],
    outflowByType: [],
    crossProjectOutflow: [],
  };
}

// ---------------------------------------------------------------------------
// Public Server Action
// ---------------------------------------------------------------------------

/**
 * Generates a full reconciliation report for a given project and time period.
 *
 * @param projectId - URL project identifier (e.g. 'juno168') or 'all'.
 * @param period    - Granularity: 'day' | 'week' | 'month'.
 * @param date      - Any date within the desired period (typically "today").
 */
export async function getReconciliationReport(
  projectId: string,
  period: "day" | "week" | "month",
  date: Date,
): Promise<ReconciliationReport> {
  const dateStr = format(date, "yyyy-MM-dd");
  const { from: startDate, to: endDate } = resolvePeriodToDateRange(period, dateStr);

  logger.info("getReconciliationReport", "Starting reconciliation report", {
    projectId,
    period,
    startDate,
    endDate,
  });

  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);

    // If a specific project was requested but couldn't be resolved, bail early.
    if (!isAll && !project) {
      logger.warn("getReconciliationReport", `Project not found: ${projectId}`);
      return emptyReport(startDate, endDate);
    }

    const projectIntId = project?.id ?? null;

    // ------------------------------------------------------------------
    // 1. Expected Inflow — canonical deposit KPI (ADR 0004):
    //    report_deposits (สำเร็จ) + report_manual_credit_in.
    //    Bonus is excluded — see ADR 0004 for rationale.
    // ------------------------------------------------------------------
    const projParam = isAll ? undefined : 3;
    const inflowSql = depositTotalSql(1, 2, projParam);

    // ------------------------------------------------------------------
    // 2. Actual Bank Balance — latest balance from report_summary_daily
    //    at or before the period end date
    // ------------------------------------------------------------------
    const balanceSql = isAll
      ? `
        SELECT COALESCE(SUM(balance), 0) AS total
        FROM (
          SELECT DISTINCT ON (project_id) balance
          FROM report_summary_daily
          WHERE report_date::date <= $1
          ORDER BY project_id, report_date DESC
        ) AS latest
      `
      : `
        SELECT COALESCE(balance, 0) AS total
        FROM report_summary_daily
        WHERE project_id = $1
          AND report_date::date <= $2
        ORDER BY report_date DESC
        LIMIT 1
      `;

    // ------------------------------------------------------------------
    // 4. Raw verified transactions for per-account grouping (in JS)
    //    Uses COALESCE(adjusted_amount, ai_amount) so admin corrections
    //    feed into systemOutflow without discarding the original ai_amount.
    // ------------------------------------------------------------------
    const rawTxSql = `
      SELECT COALESCE(t.adjusted_amount, t.ai_amount) AS adjusted_amount,
             t.ai_amount, t.sender_name, t.project_account_id AS account_id,
             pa.account_name, pa.bank_code, pa.account_number
      FROM transactions t
      LEFT JOIN project_accounts pa ON t.project_account_id = pa.id
      WHERE (t.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1 AND $2
        AND (
          t.source_project_id = $3
          OR t.target_project_id = $3
          OR $4 = true
        )
        AND t.matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')
    `;

    // ------------------------------------------------------------------
    // 5. Starting Balance (before periodStart)
    // ------------------------------------------------------------------
    const startBalSql = isAll
      ? `
        SELECT COALESCE(SUM(balance_amount), 0) AS total
        FROM (
          SELECT DISTINCT ON (project_id) balance_amount
          FROM daily_balances
          WHERE date < $1
          ORDER BY project_id, date DESC
        ) as prev_balances
      `
      : `
        SELECT COALESCE(db.balance_amount, 0) AS total
        FROM daily_balances db
        WHERE db.project_id = $1 AND db.date < $2
        ORDER BY db.date DESC LIMIT 1
      `;

    // ------------------------------------------------------------------
    // 6. Dual-balance query: fetch balance rows for exactly the selected
    //    date and the prior day using strict equality (no fallback).
    //    Both dates in a single round-trip. Used to compute slipInflow.
    // ------------------------------------------------------------------
    const dualBalSql = `
      SELECT
        pa.account_name,
        db.project_account_id::text AS project_account_id,
        db.id,
        db.source,
        db.balance_amount,
        db.date::text AS date,
        db.matching_status,
        db.image_path
      FROM daily_balances db
      JOIN project_accounts pa ON pa.id = db.project_account_id
      WHERE db.matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')
        AND db.date IN ($1::date, ($1::date - interval '1 day'))
        AND (pa.project_id = $2 OR $3 = true)
    `;

    // ------------------------------------------------------------------
    // 7. Manual transactions for per-account grouping (#49)
    // ------------------------------------------------------------------
    const manualTxSql = `
      SELECT pa.account_name, mt.amount
      FROM manual_transactions mt
      JOIN project_accounts pa ON mt.project_account_id = pa.id
      WHERE (mt.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1 AND $2
        AND (mt.project_id = $3 OR $4 = true)
    `;

    // ------------------------------------------------------------------
    // 7c. Per-type outflow rows for the selected period (ADR 0019 §131).
    //     One row per transaction with its effective amount + type name.
    //     Aggregation done in JS by aggregateOutflowByType.
    //     Also includes project_account_id for per-account breakdown (#132).
    // ------------------------------------------------------------------
    const outflowTypeSql = `
      SELECT
        tt.name AS type_name,
        t.project_account_id::text AS account_id,
        COALESCE(t.adjusted_amount, t.ai_amount) AS effective_amount
      FROM transactions t
      LEFT JOIN transaction_types tt ON t.transaction_type_id = tt.id
      WHERE (t.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1 AND $2
        AND (
          t.source_project_id = $3
          OR t.target_project_id = $3
          OR $4 = true
        )
        AND t.matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')
    `;

    // ------------------------------------------------------------------
    // 7b. Gateway parking withdrawals for the selected day (ADR 0018).
    //     Approved-only is enforced in aggregation; we fetch raw rows keyed by
    //     Bangkok date + project_account_id and carve them out of ยอดรับ.
    //     .catch degrades gracefully if migration 046 has not been applied yet.
    // ------------------------------------------------------------------
    const parkingSql = `
      SELECT
        gpw.project_account_id::text AS project_account_id,
        gpw.account_name,
        gpw.account_number,
        (gpw.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date::text AS date,
        gpw.amount,
        gpw.status
      FROM gateway_parking_withdrawals gpw
      WHERE (gpw.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date = $1
        AND (gpw.project_id = $2 OR $3 = true)
    `;

    // ------------------------------------------------------------------
    // 7f. Internal transfer detection (ADR 0020 §1): outgoing slips whose
    //     receiver 2-tier-matches a master account → inflow to that account.
    //     Uses a window-function COUNT to detect and skip ambiguous matches
    //     (receiver collides with >1 master). Scoped to receiving project_accounts.
    // ------------------------------------------------------------------
    const internalTransferSql = `
      WITH receiver_matches AS (
        SELECT
          pa.id::text AS receiving_account_id,
          (t.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date::text AS date,
          COALESCE(t.adjusted_amount, t.ai_amount) AS amount,
          COUNT(*) OVER (PARTITION BY t.id) AS match_count
        FROM transactions t
        JOIN project_accounts pa ON (
          pa.deleted_at IS NULL
          AND (pa.project_id = $2 OR $3 = true)
          AND (
            (
              regexp_replace(COALESCE(pa.account_number, ''), '[^0-9]', '', 'g')
                = regexp_replace(COALESCE(t.receiver_acc_num, ''), '[^0-9]', '', 'g')
              AND regexp_replace(COALESCE(t.receiver_acc_num, ''), '[^0-9]', '', 'g') <> ''
            )
            OR (
              t.receiver_name IS NOT NULL AND t.receiver_name <> ''
              AND t.receiver_name = pa.account_name
            )
          )
        )
        WHERE (t.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date = $1
          AND t.matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')
      )
      SELECT receiving_account_id, date, amount
      FROM receiver_matches
      WHERE match_count = 1
    `;

    // ------------------------------------------------------------------
    // 7g. Cross-project outflow rows for the selected day (ADR 0020 §5).
    //     Scope: Discord transactions whose money left the current project's
    //     accounts toward another project (target_project_id resolved and
    //     ≠ source). A null target is a same-project withdrawal (ADR 0019 §4)
    //     and is excluded.
    //     is_internal_transfer reuses the 2-tier receiver match from §1.
    // ------------------------------------------------------------------
    const crossProjectOutflowSql = `
      SELECT
        sp.project_name AS source_project_name,
        tp.project_name AS target_project_name,
        t.project_account_id::text AS account_id,
        pa.account_name,
        tt.name AS type_name,
        COALESCE(t.adjusted_amount, t.ai_amount) AS effective_amount,
        (
          SELECT COUNT(*) = 1
          FROM project_accounts pa_recv
          WHERE pa_recv.deleted_at IS NULL
            AND pa_recv.project_id = t.target_project_id
            AND (
              (
                regexp_replace(COALESCE(pa_recv.account_number, ''), '[^0-9]', '', 'g')
                  = regexp_replace(COALESCE(t.receiver_acc_num, ''), '[^0-9]', '', 'g')
                AND regexp_replace(COALESCE(t.receiver_acc_num, ''), '[^0-9]', '', 'g') <> ''
              )
              OR (
                t.receiver_name IS NOT NULL AND t.receiver_name <> ''
                AND t.receiver_name = pa_recv.account_name
              )
            )
        ) AS is_internal_transfer
      FROM transactions t
      JOIN projects sp ON t.source_project_id = sp.id
      LEFT JOIN projects tp ON t.target_project_id = tp.id
      LEFT JOIN project_accounts pa ON t.project_account_id = pa.id
      LEFT JOIN transaction_types tt ON t.transaction_type_id = tt.id
      WHERE (t.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date = $1
        AND t.matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')
        AND COALESCE(t.adjusted_amount, t.ai_amount) IS NOT NULL
        AND (t.source_project_id = $2 OR $3 = true)
        AND t.target_project_id IS NOT NULL
        AND t.target_project_id != t.source_project_id
    `;

    logger.debug("getReconciliationReport", "Executing parallel DB queries");

    const [
      inflowRes,
      balanceRes,
      rawTxRes,
      startBalRes,
      dualBalRes,
      manualTxRes,
      apayReportRes,
      parkingRes,
      outflowTypeRes,
      internalTransferRes,
      crossProjectOutflowRes,
    ] = await Promise.all([
      query(inflowSql, isAll ? [startDate, endDate] : [startDate, endDate, projectIntId]),
      query(balanceSql, isAll ? [endDate] : [projectIntId, endDate]),
      query(rawTxSql, [startDate, endDate, projectIntId, isAll]),
      query(startBalSql, isAll ? [startDate] : [projectIntId, startDate]),
      query(dualBalSql, [endDate, projectIntId, isAll]),
      query(manualTxSql, [startDate, endDate, projectIntId, isAll]).catch(() => ({ rows: [] })),
      // ADR 0016: Apay gateway report merged into the breakdown table — single-project only
      isAll
        ? Promise.resolve({ rows: [] })
        : query(buildApayAccountReportQuery(), [endDate, projectIntId]).catch(() => ({ rows: [] })),
      query(parkingSql, [endDate, projectIntId, isAll]).catch(() => ({ rows: [] })),
      query(outflowTypeSql, [startDate, endDate, projectIntId, isAll]).catch(() => ({ rows: [] })),
      query(internalTransferSql, [endDate, projectIntId, isAll]).catch(() => ({ rows: [] })),
      query(crossProjectOutflowSql, [endDate, projectIntId, isAll]).catch(() => ({ rows: [] })),
    ]);

    // ------------------------------------------------------------------
    // 8. Aggregate outflow by matched Master Account
    // ------------------------------------------------------------------
    const selectedBalRows = dualBalRes.rows.filter((r: { date: string }) => r.date === endDate);
    const prevBalRows = dualBalRes.rows.filter((r: { date: string }) => r.date !== endDate);

    const accountLevelStats: AccountLevelStat[] = buildAccountLevelStats(
      rawTxRes.rows,
      [],
      manualTxRes.rows,
      selectedBalRows,
      prevBalRows,
    );

    // ADR 0016: replace the Apay row's outflow/inflow with gateway report figures.
    // Balance snapshots come straight from the dual-balance rows (balance-only
    // accounts never get a row from buildAccountLevelStats, so we feed them in).
    if (apayReportRes.rows.length) {
      const apayReport = parseApayAccountReportRow(apayReportRes.rows[0]);
      // Match by project_account_id, NOT account_name: multiple gateway accounts
      // (Apay/Badoo/DPay) can share a name (e.g. "ACCTEAM"), so a name match would
      // grab the wrong account's balance.
      const sel = selectedBalRows.find(
        (r: { project_account_id: string }) => r.project_account_id === apayReport.accountId,
      );
      const prev = prevBalRows.find(
        (r: { project_account_id: string }) => r.project_account_id === apayReport.accountId,
      );
      const num = (v: unknown) => (v != null ? Number(v) : null);
      applyApayReportOverride(accountLevelStats, apayReport, {
        selectedDayBalance: num(sel?.balance_amount),
        prevDayBalance: num(prev?.balance_amount),
        selectedDayStatus: sel?.matching_status ?? null,
        prevDayStatus: prev?.matching_status ?? null,
        selectedDayImagePath: sel?.image_path ?? null,
        prevDayImagePath: prev?.image_path ?? null,
        selectedDayBalanceId: num(sel?.id),
        prevDayBalanceId: num(prev?.id),
        selectedDaySource: sel?.source ?? null,
        prevDaySource: prev?.source ?? null,
      });
    }

    // ADR 0018: carve gateway parking out of each account's ยอดรับ. Attribute by
    // project_account_id for the selected day; reportSourced (Apay) rows ignore it.
    const parkingByAccount = aggregateParkingByAccountDay(parkingRes.rows);
    for (const s of accountLevelStats) {
      s.parkingIn = (s.accountId && parkingByAccount.get(s.accountId)?.get(endDate)) || 0;
    }
    // FK-null Approved parking (ADR 0018 §4) — landed in unregistered accounts,
    // harmless to the formula, surfaced per account so an admin can register them.
    const unregisteredParking = aggregateUnregisteredParking(parkingRes.rows);

    // ADR 0020 §1: carve internal-transfer inflows out of each receiving account's ยอดรับ.
    const internalByAccount = aggregateInternalTransferByAccountDay(internalTransferRes.rows);
    for (const s of accountLevelStats) {
      s.internalIn = (s.accountId && internalByAccount.get(s.accountId)?.get(endDate)) || 0;
    }

    // ADR 0019 phase 1: per-account type breakdown (display-only).
    const typeByAccount = groupOutflowByAccount(outflowTypeRes.rows);
    for (const s of accountLevelStats) {
      s.typeBreakdown = (s.accountId && typeByAccount.get(s.accountId)) || [];
    }

    // ------------------------------------------------------------------
    // 8. Compute variance
    //    Total Expected Balance = Starting Balance + Inflow - Effective Outflow
    //    Variance = Total Expected Balance - Actual Bank Balance
    // ------------------------------------------------------------------
    const startingBalance = Number(startBalRes.rows[0]?.total ?? 0);
    const expectedInflow = Number(inflowRes.rows[0]?.total ?? 0);
    const actualBalance = Number(balanceRes.rows[0]?.total ?? 0);

    const adjustmentsTotal = 0;
    // Includes the Apay gateway withdrawal (ADR 0016) — drives card 3 + the table total.
    const effectiveOutflowTotal = accountLevelStats.reduce(
      (sum, s) => sum + s.effectiveOutflow,
      0,
    );
    // Bank-side cash outflow only — excludes gateway report rows, which are not
    // real cash movements out of the tracked bank balance (feeds variance).
    const cashOutflowTotal = accountLevelStats.reduce(
      (sum, s) => (s.reportSourced ? sum : sum + s.effectiveOutflow),
      0,
    );

    const slipInflow = accountLevelStats.reduce((sum, s) => {
      const r = resolveAccountInflow(s);
      return r.value !== null ? sum + r.value : sum;
    }, 0);

    const expectedBalance =
      startingBalance + expectedInflow - cashOutflowTotal;
    const variance = expectedBalance - actualBalance;

    logger.info("getReconciliationReport", "Report generated successfully", {
      projectId,
      period,
      expectedBalance,
      actualBalance,
      variance,
      accountsMatched: accountLevelStats.length,
    });

    const outflowByType = aggregateOutflowByType(outflowTypeRes.rows);
    const crossProjectOutflow = computeCrossProjectOutflow(crossProjectOutflowRes.rows, isAll);

    return {
      startingBalance,
      expectedInflow,
      adjustmentsTotal,
      effectiveOutflowTotal,
      actualBalance,
      expectedBalance,
      variance,
      slipInflow,
      unregisteredParking,
      outflowByType,
      crossProjectOutflow,
      accountLevelStats,
      periodStart: startDate,
      periodEnd: endDate,
      todayBalance: actualBalance,
      yesterdayBalance: startingBalance,
    };
  } catch (error) {
    logger.error(
      "getReconciliationReport",
      "Failed to generate reconciliation report",
      { projectId, period, startDate, endDate, error },
    );
    return emptyReport(startDate, endDate);
  }
}

// ---------------------------------------------------------------------------
// Manual Adjustments
// ---------------------------------------------------------------------------

export interface CreateAdjustmentInput {
  projectId: string;
  masterAccount: string;
  amount: number;
  reason: string;
  adjustmentDate: string;
}

/**
 * Creates a new manual adjustment to handle reconciliation discrepancies.
 * Requires ADMIN role.
 */
export async function addManualAdjustment(data: CreateAdjustmentInput) {
  logger.info("addManualAdjustment", "Adding manual adjustment", data);
  const session = await getServerAuthSession();

  if (!session || !hasPermission(session.user.role, 'manage_projects')) {
    logger.warn(
      "addManualAdjustment",
      "Unauthorized attempt to add adjustment",
    );
    return { success: false, error: "Unauthorized" };
  }

  try {
    const isAll = data.projectId === "all";
    const projectIntId = isAll
      ? null
      : (await resolveProject(data.projectId))?.id;

    if (!isAll && !projectIntId) {
      return { success: false, error: "Project not found" };
    }

    const sql = `
      INSERT INTO manual_adjustments (
        project_id, master_account, amount, reason, adjustment_date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const params = [
      projectIntId ?? null,
      data.masterAccount,
      data.amount,
      data.reason,
      data.adjustmentDate,
      session.user.username,
    ];

    await query(sql, params);

    logger.info(
      "addManualAdjustment",
      "Manual adjustment created successfully",
    );

    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    logger.error(
      "addManualAdjustment",
      "Failed to add manual adjustment",
      error,
    );
    return { success: false, error: "Failed to add manual adjustment" };
  }
}
