"use server";

import { query } from "@/lib/db";
import { matchMasterAccount } from "@/lib/accountMatcher";
import { logger } from "@/lib/logger";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { getServerAuthSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountLevelStat {
  /** Master account name */
  account: string;
  /** OCR-verified outflow amount for this account */
  systemOutflow: number;
  /** Sum of manual adjustments */
  adjustments: number;
  /** systemOutflow + (-adjustments) */
  effectiveOutflow: number;
  /** Number of system transactions */
  count: number;
}

export interface ReconciliationReport {
  startingBalance: number;
  expectedInflow: number;
  expectedOutflow: number;
  adjustmentsTotal: number;
  effectiveOutflowTotal: number;
  actualBalance: number;
  expectedBalance: number;
  variance: number;
  accountLevelStats: AccountLevelStat[];
  periodStart: string;
  periodEnd: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a project URL identifier (e.g. 'juno168') to its UUID and canonical
 * name. Returns null for the 'all' aggregate view.
 */
async function resolveProject(
  projectId: string,
): Promise<{ id: string; name: string } | null> {
  if (projectId === "all" || !projectId) return null;
  try {
    const result = await query(
      `SELECT id, project_name
       FROM projects
       WHERE project_name ILIKE '%' || $1 || '%'
         AND status = 'ACTIVE'
       LIMIT 1`,
      [projectId],
    );
    if (!result.rows[0]) return null;
    return { id: result.rows[0].id, name: result.rows[0].project_name };
  } catch (err) {
    logger.error("reconciliation.resolveProject", `Failed to resolve project: ${projectId}`, err);
    return null;
  }
}

/**
 * Computes the inclusive [startDate, endDate] strings for the requested period.
 */
function resolvePeriod(
  period: "day" | "week" | "month",
  date: Date,
): { startDate: string; endDate: string } {
  switch (period) {
    case "day":
      return {
        startDate: format(date, "yyyy-MM-dd"),
        endDate: format(date, "yyyy-MM-dd"),
      };
    case "week":
      return {
        // ISO week: Monday → Sunday
        startDate: format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        endDate: format(endOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "month":
      return {
        startDate: format(startOfMonth(date), "yyyy-MM-dd"),
        endDate: format(endOfMonth(date), "yyyy-MM-dd"),
      };
  }
}

/** Empty report used as a safe fallback on errors or unresolvable projects. */
function emptyReport(
  startDate: string,
  endDate: string,
): ReconciliationReport {
  return {
    startingBalance: 0,
    expectedInflow: 0,
    expectedOutflow: 0,
    adjustmentsTotal: 0,
    effectiveOutflowTotal: 0,
    actualBalance: 0,
    expectedBalance: 0,
    variance: 0,
    accountLevelStats: [],
    periodStart: startDate,
    periodEnd: endDate,
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
  const { startDate, endDate } = resolvePeriod(period, date);

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
      logger.warn(
        "getReconciliationReport",
        `Project not found: ${projectId}`,
      );
      return emptyReport(startDate, endDate);
    }

    const projectName = project?.name ?? "";
    const projectUuid = project?.id ?? null;

    // ------------------------------------------------------------------
    // 1. Expected Inflow — SUM of amount from report_deposits (สำเร็จ)
    // ------------------------------------------------------------------
    const inflowSql = `
      SELECT COALESCE(SUM(rd.amount), 0) AS total
      FROM report_deposits rd
      WHERE rd.status = 'สำเร็จ'
        AND rd.trans_date::date BETWEEN $1 AND $2
        AND (
          $3 = true
          OR rd.web_acc ILIKE '%' || $4 || '%'
        )
    `;

    // ------------------------------------------------------------------
    // 2. Expected Outflow — SUM of ai_amount from verified transactions
    // ------------------------------------------------------------------
    const outflowSql = `
      SELECT COALESCE(SUM(t.ai_amount), 0) AS total
      FROM transactions t
      WHERE t.is_amount_verified = true
        AND t.transfer_date::date BETWEEN $1 AND $2
        AND (
          t.source_project_id = $3
          OR t.target_project_id = $3
          OR $4 = true
        )
        AND t.matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')
    `;

    // ------------------------------------------------------------------
    // 3. Actual Bank Balance — latest balance from report_summary_daily
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
        WHERE project_id ILIKE '%' || $1 || '%'
          AND report_date::date <= $2
        ORDER BY report_date DESC
        LIMIT 1
      `;

    // ------------------------------------------------------------------
    // 4. Raw verified transactions for per-account grouping (in JS)
    // ------------------------------------------------------------------
    const rawTxSql = `
      SELECT t.ai_amount, t.sender_name, t.project_account_id, pa.account_name
      FROM transactions t
      LEFT JOIN project_accounts pa ON t.project_account_id = pa.id
      WHERE t.is_amount_verified = true
        AND t.transfer_date::date BETWEEN $1 AND $2
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
          SELECT DISTINCT ON (project_name) balance_amount 
          FROM daily_balances 
          WHERE date < $1
          ORDER BY project_name, date DESC
        ) as prev_balances
      `
      : `
        SELECT COALESCE(db.balance_amount, 0) AS total 
        FROM daily_balances db
        JOIN projects p ON db.project_name = p.project_name
        WHERE p.project_name ILIKE '%' || $1 || '%' AND db.date < $2
        ORDER BY db.date DESC LIMIT 1
      `;

    // ------------------------------------------------------------------
    // 6. Manual Adjustments for the period
    // ------------------------------------------------------------------
    const adjustmentsSql = `
      SELECT master_account, amount 
      FROM manual_adjustments 
      WHERE adjustment_date BETWEEN $1 AND $2
        AND (project_id = $3 OR $4 = true)
    `;

    logger.debug("getReconciliationReport", "Executing parallel DB queries");

    const [inflowRes, outflowRes, balanceRes, rawTxRes, startBalRes, extAdjRes] = await Promise.all([
      query(inflowSql, [startDate, endDate, isAll, projectName]),
      query(outflowSql, [startDate, endDate, projectUuid, isAll]),
      query(balanceSql, isAll ? [endDate] : [projectName, endDate]),
      query(rawTxSql, [startDate, endDate, projectUuid, isAll]),
      query(startBalSql, isAll ? [startDate] : [projectName, startDate]),
      query(adjustmentsSql, [startDate, endDate, projectUuid, isAll]),
    ]);

    // ------------------------------------------------------------------
    // 7. Aggregate outflow and adjustments by matched Master Account
    // ------------------------------------------------------------------
    const accountMap = new Map<
      string,
      { systemOutflow: number; adjustments: number; count: number }
    >();

    for (const row of rawTxRes.rows) {
      // Prioritize saved database match, fall back to on-the-fly fuzzy match
      const matchedName = row.account_name || matchMasterAccount(row.sender_name as string | null);
      const amount = Number(row.ai_amount ?? 0);
      const existing = accountMap.get(matchedName);
      if (existing) {
        existing.systemOutflow += amount;
        existing.count += 1;
      } else {
        accountMap.set(matchedName, { systemOutflow: amount, adjustments: 0, count: 1 });
      }
    }

    for (const row of extAdjRes.rows) {
      const acc = row.master_account;
      const amount = Number(row.amount ?? 0);
      const existing = accountMap.get(acc);
      if (existing) {
        existing.adjustments += amount;
      } else {
        accountMap.set(acc, { systemOutflow: 0, adjustments: amount, count: 0 });
      }
    }

    const accountLevelStats: AccountLevelStat[] = Array.from(accountMap.entries())
      .map(([account, { systemOutflow, adjustments, count }]) => ({
        account,
        systemOutflow,
        adjustments,
        effectiveOutflow: systemOutflow - adjustments,
        count,
      }))
      .sort((a, b) => b.effectiveOutflow - a.effectiveOutflow);

    // ------------------------------------------------------------------
    // 8. Compute variance
    //    Total Expected Balance = Starting Balance + Inflow - Effective Outflow
    //    Variance = Total Expected Balance - Actual Bank Balance
    // ------------------------------------------------------------------
    const startingBalance = Number(startBalRes.rows[0]?.total ?? 0);
    const expectedInflow = Number(inflowRes.rows[0]?.total ?? 0);
    const expectedOutflow = Number(outflowRes.rows[0]?.total ?? 0);
    const actualBalance = Number(balanceRes.rows[0]?.total ?? 0);

    const adjustmentsTotal = accountLevelStats.reduce((sum, s) => sum + s.adjustments, 0);
    const effectiveOutflowTotal = accountLevelStats.reduce((sum, s) => sum + s.effectiveOutflow, 0);

    const expectedBalance = startingBalance + expectedInflow - effectiveOutflowTotal;
    const variance = expectedBalance - actualBalance;

    logger.info("getReconciliationReport", "Report generated successfully", {
      projectId,
      period,
      expectedBalance,
      actualBalance,
      variance,
      accountsMatched: accountLevelStats.length,
    });

    return {
      startingBalance,
      expectedInflow,
      expectedOutflow,
      adjustmentsTotal,
      effectiveOutflowTotal,
      actualBalance,
      expectedBalance,
      variance,
      accountLevelStats,
      periodStart: startDate,
      periodEnd: endDate,
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

  if (!session || session.user.role !== "ADMIN") {
    logger.warn("addManualAdjustment", "Unauthorized attempt to add adjustment");
    return { success: false, error: "Unauthorized" };
  }

  try {
    const isAll = data.projectId === "all";
    const projectUuid = isAll ? null : (await resolveProject(data.projectId))?.id;

    if (!isAll && !projectUuid) {
      return { success: false, error: "Project not found" };
    }

    const sql = `
      INSERT INTO manual_adjustments (
        project_id, master_account, amount, reason, adjustment_date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const params = [
      projectUuid || data.projectId,
      data.masterAccount,
      data.amount,
      data.reason,
      data.adjustmentDate,
      session.user.id,
    ];

    await query(sql, params);
    
    logger.info("addManualAdjustment", "Manual adjustment created successfully");
    
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    logger.error("addManualAdjustment", "Failed to add manual adjustment", error);
    return { success: false, error: "Failed to add manual adjustment" };
  }
}
