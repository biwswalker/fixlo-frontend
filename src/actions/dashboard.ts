"use server";

import { query } from "@/lib/db";
import { subDays, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { runSmartMatch } from "@/lib/smartMatcher";
import { getServerAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { computeKpi } from "@/lib/reconciliationFormula";
import { normalizeTransferAt } from "@/lib/normalizeTransferAt";
import { nextState } from "@/lib/transactionState";
import { buildTransferAt } from "@/lib/transferAt";
import { resolveProject } from "@/lib/projects";
import { canSoftDelete } from "@/lib/projectAccountRules";
import { aggregateBreakdown } from "@/lib/accountFormatters";
import { idOrAll } from "@/lib/projectFilter";
import { mergeDailyChartRows } from "@/lib/cashflowChart";
import {
  depositTotalSql,
  withdrawTotalSql,
  depositPerDaySql,
  withdrawPerDaySql,
} from "@/lib/kpiSql";
import { ProjectAccount } from "./dashboard";
import { TransactionRecord } from "./dashboard";
import { DashboardSummary } from "./dashboard";
import { AccountBreakdown } from "./dashboard";

export type {
  AccountBreakdown,
  DashboardSummary,
  TransactionRecord,
  ProjectAccount,
} from "@/types/dashboard";

/**
 * Normalizes date range for queries.
 */
function getDateRange(from?: string, to?: string) {
  const startDate = from || format(subDays(new Date(), 7), "yyyy-MM-dd");
  const endDate = to || format(new Date(), "yyyy-MM-dd");
  return { startDate, endDate };
}



/**
 * Fetches all active projects for the switcher.
 */
export async function getActiveProjects(): Promise<
  { id: string; project_name: string }[]
> {
  try {
    const sql =
      "SELECT id, project_name FROM projects WHERE status = 'ACTIVE' ORDER BY project_name ASC";
    const result = await query(sql);
    return result.rows;
  } catch (error) {
    logger.error("getActiveProjects", "Failed to fetch active projects", error);
    return [];
  }
}

export interface ProjectOption {
  id: string;
  code: string;
  name: string;
  color: string;
}

// Deterministic color palette — stable across renders for the same project name.
const PROJECT_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-pink-600",
];

function projectColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

/**
 * Returns one ProjectOption per active project plus the 'all' aggregate.
 * Replaces the removed PROJECTS_MAP constant — adding a project only requires a DB insert.
 */
export async function getProjectOptions(): Promise<ProjectOption[]> {
  try {
    const sql =
      "SELECT id, code, project_name FROM projects WHERE status = 'ACTIVE' ORDER BY project_name ASC";
    const result = await query(sql);
    const projects: ProjectOption[] = result.rows.map((row) => ({
      id: String(row.id),
      code: row.code,
      name: row.project_name,
      color: projectColor(row.project_name),
    }));
    return [
      { id: "all", code: "all", name: "ทุกโปรเจกต์", color: "bg-gray-700" },
      ...projects,
    ];
  } catch (error) {
    logger.error("getProjectOptions", "Failed to fetch project options", error);
    return [{ id: "all", code: "all", name: "ทุกโปรเจกต์", color: "bg-gray-700" }];
  }
}

/**
 * Resolves a project URL slug to { id, project_name } for page-level use.
 * Delegates to resolveProject (exact code + alias lookup, no ILIKE).
 */
export async function getProjectByName(
  slug: string,
): Promise<{ id: string; project_name: string } | null> {
  if (slug === "all") return { id: "all", project_name: "ทุกโปรเจกต์" };
  const ref = await resolveProject(slug);
  if (!ref) return null;
  return { id: String(ref.id), project_name: ref.name };
}

/**
 * Fetches the dashboard summary metrics.
 * @param projectId - The project identifier or 'all'.
 * @param from - Start date (YYYY-MM-DD).
 * @param to - End date (YYYY-MM-DD).
 */
export async function getDashboardSummary(
  projectId: string,
  from?: string,
  to?: string,
): Promise<DashboardSummary> {
  try {
    const isAll = projectId === "all";
    const { startDate, endDate } = getDateRange(from, to);

    const project = isAll ? null : await resolveProject(projectId);
    if (!isAll && !project) {
      return {
        totalDeposits: 0,
        totalWithdrawals: 0,
        latestBalance: 0,
        deposit: 0,
        manualIn: 0,
        withdraw: 0,
        manualOut: 0,
        depositBreakdown: [],
        withdrawalBreakdown: [],
      };
    }

    const projectIntId = project?.id ?? null;

    // latestBalance continues to read report_summary_daily.balance (ADR 0004)
    const balanceQuery = isAll
      ? `
        SELECT COALESCE(SUM(balance), 0) as latest_balance
        FROM (
          SELECT DISTINCT ON (project_id) balance
          FROM report_summary_daily
          WHERE report_date <= $1
          ORDER BY project_id, report_date DESC
        ) as latest_balances
      `
      : `
        SELECT COALESCE(balance, 0) as latest_balance
        FROM report_summary_daily
        WHERE project_id = $1
        AND report_date <= $2
        ORDER BY report_date DESC
        LIMIT 1
      `;

    const projectFilter = isAll ? "" : "AND project_id = $3";
    const reportParams = isAll ? [startDate, endDate] : [startDate, endDate, projectIntId];

    const depositsBreakdownQuery = `
      SELECT web_acc as account, COALESCE(SUM(amount), 0) as total
      FROM report_deposits
      WHERE trans_date::date BETWEEN $1 AND $2
      AND status = 'สำเร็จ'
      ${projectFilter}
      GROUP BY web_acc
      ORDER BY total DESC
    `;

    const withdrawalsBreakdownQuery = `
      SELECT web_acc as account, COALESCE(SUM(amount), 0) as total
      FROM report_withdrawals
      WHERE trans_date::date BETWEEN $1 AND $2
      AND status = 'สำเร็จ'
      ${projectFilter}
      GROUP BY web_acc
      ORDER BY total DESC
    `;

    const depositOnlyQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM report_deposits
      WHERE status = 'สำเร็จ'
      AND trans_date::date BETWEEN $1 AND $2
      ${projectFilter}
    `;

    const manualInQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM report_manual_credit_in
      WHERE trans_date::date BETWEEN $1 AND $2
      ${projectFilter}
    `;

    const withdrawOnlyQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM report_withdrawals
      WHERE status = 'สำเร็จ'
      AND trans_date::date BETWEEN $1 AND $2
      ${projectFilter}
    `;

    const manualOutQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM report_manual_credit_out
      WHERE trans_date::date BETWEEN $1 AND $2
      ${projectFilter}
    `;

    logger.debug(
      "getDashboardSummary",
      `Resolved project for projectId: ${projectId}`,
      project,
    );

    const kpiProjectParam = isAll ? undefined : 3;

    const [
      balanceRes,
      depositsRes,
      withdrawalsRes,
      depositOnlyRes,
      manualInRes,
      withdrawOnlyRes,
      manualOutRes,
      totalDepositRes,
      totalWithdrawRes,
    ] = await Promise.all([
      query(balanceQuery, isAll ? [endDate] : [projectIntId, endDate]),
      query(depositsBreakdownQuery, reportParams),
      query(withdrawalsBreakdownQuery, reportParams),
      query(depositOnlyQuery, reportParams),
      query(manualInQuery, reportParams),
      query(withdrawOnlyQuery, reportParams),
      query(manualOutQuery, reportParams),
      query(depositTotalSql(1, 2, kpiProjectParam), reportParams),
      query(withdrawTotalSql(1, 2, kpiProjectParam), reportParams),
    ]);

    const deposit = Number(depositOnlyRes.rows[0]?.total || 0);
    const manualIn = Number(manualInRes.rows[0]?.total || 0);
    const withdraw = Number(withdrawOnlyRes.rows[0]?.total || 0);
    const manualOut = Number(manualOutRes.rows[0]?.total || 0);

    return {
      totalDeposits: Number(totalDepositRes.rows[0]?.total || 0),
      totalWithdrawals: Number(totalWithdrawRes.rows[0]?.total || 0),
      latestBalance: Number(balanceRes.rows[0]?.latest_balance || 0),
      deposit,
      manualIn,
      withdraw,
      manualOut,
      depositBreakdown: aggregateBreakdown(depositsRes.rows),
      withdrawalBreakdown: aggregateBreakdown(withdrawalsRes.rows),
    };
  } catch (error) {
    logger.error("getDashboardSummary", "Failed to fetch dashboard summary", {
      projectId,
      from,
      to,
      error,
    });

    return {
      totalDeposits: 0,
      totalWithdrawals: 0,
      latestBalance: 0,
      deposit: 0,
      manualIn: 0,
      withdraw: 0,
      manualOut: 0,
      depositBreakdown: [],
      withdrawalBreakdown: [],
    };
  }
}

/**
 * Fetches daily chart data for the selected range.
 */
export async function getDailyChartData(
  projectId: string,
  from?: string,
  to?: string,
) {
  try {
    const { startDate, endDate } = getDateRange(from, to);
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);
    const projectIntId = project?.id ?? null;
    const projParam = isAll ? undefined : 3;
    const dateParams = isAll ? [startDate, endDate] : [startDate, endDate, projectIntId];

    logger.debug("getDailyChartData", "Fetching chart data from canonical KPI lib", { projectId, startDate, endDate });

    const [depositsRes, withdrawalsRes] = await Promise.all([
      query(depositPerDaySql(1, 2, projParam), dateParams),
      query(withdrawPerDaySql(1, 2, projParam), dateParams),
    ]);

    return mergeDailyChartRows(depositsRes.rows, withdrawalsRes.rows);
  } catch (error) {
    logger.error(
      "getDailyChartData",
      "Failed to fetch daily chart data",
      error,
    );
    return [];
  }
}

// getReconciliationStatus removed — use getReconciliationReport from @/actions/reconciliation instead.
// period='day' produces single-day status; todayBalance and yesterdayBalance are included in ReconciliationReport.

/**
 * Approves a transaction (PENDING_REVIEW → MANUAL_MAPPED).
 * Requires approve_transactions permission (staff, admin, owner).
 */
export async function approveTransaction(id: string) {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const currentRes = await query(
    "SELECT matching_status FROM transactions WHERE id = $1",
    [id],
  ).catch(() => null);
  const current = currentRes?.rows[0]?.matching_status ?? "UNMAPPED";

  const transition = nextState({ current, action: "confirm_mapping", actorRole: session.user.role ?? "" });
  if ("error" in transition) {
    return { success: false, error: transition.error === "forbidden" ? "Unauthorized" : "Invalid transition" };
  }

  try {
    await query(
      "UPDATE transactions SET matching_status = $1 WHERE id = $2",
      [transition.next, id],
    );
    return { success: true };
  } catch (error) {
    logger.error("approveTransaction", "Failed to approve transaction", error);
    return { success: false, error: "Failed to approve transaction" };
  }
}

/**
 * Force approves a transaction from any state (admin/owner only).
 */
export async function forceApproveTransaction(id: string) {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const currentRes = await query(
    "SELECT matching_status FROM transactions WHERE id = $1",
    [id],
  ).catch(() => null);
  const current = currentRes?.rows[0]?.matching_status ?? "UNMAPPED";

  const transition = nextState({ current, action: "force_approve", actorRole: session.user.role ?? "" });
  if ("error" in transition) {
    return { success: false, error: transition.error === "forbidden" ? "Unauthorized" : "Invalid transition" };
  }

  try {
    await query(
      `UPDATE transactions SET matching_status = $1, is_duplicate = false WHERE id = $2`,
      [transition.next, id],
    );
    revalidatePath("/dashboard/[projectId]", "page");
    return { success: true };
  } catch (error) {
    logger.error("forceApproveTransaction", "Failed to force approve transaction", error);
    return { success: false, error: "Failed to force approve transaction" };
  }
}

/**
 * Fetches all project accounts for a specific project.
 */
export async function getProjectAccounts(
  projectId: string,
): Promise<ProjectAccount[]> {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);

    const projectIntId = project?.id ?? null;

    const sql = `
      SELECT id, project_id, account_name, account_number, bank_code, aliases, created_at
      FROM project_accounts
      WHERE (project_id = $1 OR $2 = true)
        AND deleted_at IS NULL
      ORDER BY account_name ASC
    `;

    const result = await query(sql, [projectIntId, isAll]);

    return result.rows.map((row) => ({
      ...row,
      created_at: row.created_at.toISOString(),
    }));
  } catch (error) {
    logger.error(
      "getProjectAccounts",
      "Failed to fetch project accounts",
      error,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Project Account CRUD (issue #45)
// ---------------------------------------------------------------------------

export async function createProjectAccount(
  projectId: string,
  accountName: string,
  bankCode: string,
  accountNumber: string,
  aliases: string[],
) {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const project = await resolveProject(projectId);
    if (!project) return { success: false, error: "Project not found" };

    await query(
      `INSERT INTO project_accounts (project_id, account_name, bank_code, account_number, aliases)
       VALUES ($1, $2, $3, $4, $5)`,
      [project.id, accountName, bankCode, accountNumber || null, JSON.stringify(aliases)],
    );
    revalidatePath(`/dashboard/${projectId}/accounts`);
    return { success: true };
  } catch (error) {
    logger.error("createProjectAccount", "Failed to create project account", error);
    return { success: false, error: "Failed to create project account" };
  }
}

export async function updateProjectAccount(
  id: string,
  accountName: string,
  bankCode: string,
  accountNumber: string,
  aliases: string[],
) {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await query(
      `UPDATE project_accounts
         SET account_name = $1, bank_code = $2, account_number = $3, aliases = $4
       WHERE id = $5 AND deleted_at IS NULL`,
      [accountName, bankCode, accountNumber || null, JSON.stringify(aliases), id],
    );
    revalidatePath("/dashboard/[projectId]/accounts", "page");
    return { success: true };
  } catch (error) {
    logger.error("updateProjectAccount", "Failed to update project account", error);
    return { success: false, error: "Failed to update project account" };
  }
}

export async function softDeleteProjectAccount(id: string) {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const countRes = await query(
      `SELECT COUNT(*) AS cnt
         FROM transactions
        WHERE project_account_id = $1
          AND matching_status NOT IN ('REJECTED')`,
      [id],
    );
    const mappedCount = Number(countRes.rows[0]?.cnt ?? 0);
    const check = canSoftDelete(mappedCount);
    if (!check.allowed) return { success: false, error: check.reason };

    await query(
      `UPDATE project_accounts SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    revalidatePath("/dashboard/[projectId]/accounts", "page");
    return { success: true };
  } catch (error) {
    logger.error("softDeleteProjectAccount", "Failed to soft-delete project account", error);
    return { success: false, error: "Failed to delete project account" };
  }
}

export interface OcrResultInput {
  source_project_id: string;
  target_project_id: string;
  amount: number;
  ai_amount: number;
  sender_name: string;
  sender_account: string;
  sender_bank: string;
  receiver_name: string;
  /** UTC ISO timestamp — use buildTransferAt() to construct from Bangkok-local inputs */
  transfer_at: string;
  image_path: string;
}

/**
 * Saves the AI OCR result into the transactions table and performs Smart Matching.
 */
export async function saveTransactionOcrResult(input: OcrResultInput) {
  try {
    // 1. Fetch project accounts for matching
    // We use the source_project_id (UUID) to fetch accounts
    const accounts = await getProjectAccounts(input.source_project_id);

    // 2. Run Smart Match
    const match = runSmartMatch(
      {
        name: input.sender_name,
        account: input.sender_account,
        bank: input.sender_bank,
      },
      accounts,
    );

    // 3. Insert into transactions
    const sql = `
      INSERT INTO transactions (
        source_project_id,
        target_project_id,
        amount,
        ai_amount,
        sender_name,
        receiver_name,
        sender_bank,
        transfer_at,
        image_path,
        project_account_id,
        matching_status,
        matching_confidence,
        possible_matches,
        sender_acc_num
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `;

    const params = [
      input.source_project_id,
      input.target_project_id,
      input.amount,
      input.ai_amount,
      input.sender_name,
      input.receiver_name,
      input.sender_bank,
      input.transfer_at,
      input.image_path,
      match.matchedAccountId,
      match.status,
      match.score,
      match.possibleMatches || null,
      input.sender_account,
    ];

    const result = await query(sql, params);

    logger.info(
      "saveTransactionOcrResult",
      "Transaction saved with matching result",
      {
        txnId: result.rows[0].id,
        status: match.status,
        score: match.score,
      },
    );

    revalidatePath("/dashboard/[projectId]", "page");
    return { success: true, id: result.rows[0].id, match };
  } catch (error) {
    logger.error(
      "saveTransactionOcrResult",
      "Failed to save transaction",
      error,
    );
    return { success: false, error: "Failed to save transaction" };
  }
}

/**
 * Fetches transactions that need manual matching review.
 */
export async function getPendingMatchCount(projectId: string, date?: string): Promise<number> {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);
    const res = await query(
      `SELECT COUNT(*) as total FROM transactions
       WHERE (source_project_id = $1 OR $2 = true)
         AND matching_status IN ('PENDING_REVIEW', 'UNMAPPED')
         AND ($3::date IS NULL OR (transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date = $3::date)`,
      [project?.id || null, isAll, date ?? null],
    );
    return Number(res.rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

export async function getPendingBalanceMatchCount(projectId: string, date?: string): Promise<number> {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);
    const res = await query(
      `SELECT COUNT(*) as total
       FROM daily_balances db
       LEFT JOIN project_accounts pa ON db.project_account_id = pa.id
       WHERE (pa.project_id = $1 OR $2 = true OR (db.project_id = $1 AND $2 = false AND pa.id IS NULL))
         AND db.matching_status IN ('PENDING_REVIEW', 'UNMATCHED')
         AND ($3::date IS NULL OR db.date = $3::date)`,
      [project?.id || null, isAll, date ?? null],
    );
    return Number(res.rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

export async function getPendingMatches(
  projectId: string,
  page: number = 1,
  limit: number = 50,
  search?: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<{
  data: TransactionRecord[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}> {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);

    const OFFSET = (page - 1) * limit;
    const searchFilter = search ? `%${search}%` : null;
    const fromFilter = dateFrom ?? null;
    const toFilter = dateTo ?? null;

    const sql = `
      SELECT t.*, p.project_name
      FROM transactions t
      LEFT JOIN projects p ON t.source_project_id = p.id
      WHERE (t.source_project_id = $1 OR $2 = true)
        AND t.matching_status IN ('PENDING_REVIEW', 'UNMAPPED')
        AND ($5::text IS NULL OR t.ref_id ILIKE $5 OR t.sender_name ILIKE $5 OR t.sender_acc_num ILIKE $5)
        AND ($6::date IS NULL OR (t.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date >= $6::date)
        AND ($7::date IS NULL OR (t.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date <= $7::date)
      ORDER BY t.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM transactions t
      WHERE (t.source_project_id = $1 OR $2 = true)
        AND t.matching_status IN ('PENDING_REVIEW', 'UNMAPPED')
        AND ($3::text IS NULL OR t.ref_id ILIKE $3 OR t.sender_name ILIKE $3 OR t.sender_acc_num ILIKE $3)
        AND ($4::date IS NULL OR (t.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date >= $4::date)
        AND ($5::date IS NULL OR (t.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date <= $5::date)
    `;

    const [result, countRes] = await Promise.all([
      query(sql, [project?.id || null, isAll, limit, OFFSET, searchFilter, fromFilter, toFilter]),
      query(countSql, [project?.id || null, isAll, searchFilter, fromFilter, toFilter]),
    ]);

    const totalItems = Number(countRes.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalItems / limit);

    const data = result.rows.map((row) => ({
      ...row,
      id: String(row.id),
      sender_account: row.sender_acc_num || "",
      ref_id: row.ref_id || "",
      amount: Number(row.amount || 0),
      ai_amount: Number(row.ai_amount || 0),
      matching_confidence: Number(row.matching_confidence || 0),
      match_breakdown: row.match_breakdown ?? null,
      created_at: row.created_at?.toISOString() || "",
      transfer_at: row.transfer_at ? row.transfer_at.toISOString() : "",
    }));

    return {
      data,
      totalItems,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    return {
      data: [],
      totalItems: 0,
      totalPages: 0,
      currentPage: page,
    };
  }
}

/**
 * Confirms a manual mapping for a transaction.
 */
export async function confirmTransactionMapping(
  transactionId: string,
  selectedAccountId: string,
) {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const currentRes = await query(
    "SELECT matching_status FROM transactions WHERE id = $1",
    [transactionId],
  ).catch(() => null);
  const current = currentRes?.rows[0]?.matching_status ?? "PENDING_REVIEW";

  const transition = nextState({ current, action: "confirm_mapping", actorRole: session.user.role ?? "" });
  if ("error" in transition) {
    return { success: false, error: transition.error === "forbidden" ? "Unauthorized" : "Invalid transition" };
  }

  try {
    const sql = `
      UPDATE transactions
      SET project_account_id = $1,
          matching_status = $2
      WHERE id = $3
    `;
    await query(sql, [selectedAccountId, transition.next, transactionId]);
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    logger.error("confirmTransactionMapping", "Failed to confirm mapping", error);
    return { success: false, error: "Failed to confirm mapping" };
  }
}

export type RejectPreset = "สลิปซ้ำ" | "ยอดผิด" | "ผิด project" | "test slip" | "อื่นๆ";

/**
 * Rejects a slip with a preset reason. Requires owner or admin.
 * The slip remains in the DB for audit trail but is excluded from the pending list
 * (which filters PENDING_REVIEW / UNMAPPED only).
 */
export async function rejectTransaction(
  transactionId: string,
  preset: RejectPreset,
  customNote?: string,
) {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const currentRes = await query(
    "SELECT matching_status FROM transactions WHERE id = $1",
    [transactionId],
  ).catch(() => null);
  const current = currentRes?.rows[0]?.matching_status ?? "UNMAPPED";

  const transition = nextState({ current, action: "reject", actorRole: session.user.role ?? "" });
  if ("error" in transition) {
    return {
      success: false,
      error: transition.error === "forbidden" ? "Unauthorized" : "Invalid transition",
    };
  }

  const reason = preset === "อื่นๆ" ? (customNote ?? "อื่นๆ") : preset;

  try {
    await query(
      `UPDATE transactions
         SET matching_status = $1,
             reject_reason   = $2,
             rejected_by     = $3,
             rejected_at     = NOW()
       WHERE id = $4`,
      [transition.next, reason, session.user.username, transactionId],
    );
    revalidatePath("/dashboard/[projectId]/match", "page");
    return { success: true };
  } catch (error) {
    logger.error("rejectTransaction", "Failed to reject transaction", error);
    return { success: false, error: "Failed to reject transaction" };
  }
}

/**
 * Rejects multiple Discord slips in a single batch. Requires manage_projects.
 * Returns per-id results so the caller can report partial failures.
 */
export async function batchRejectTransactions(
  ids: number[],
  preset: RejectPreset,
  customNote?: string,
): Promise<{ succeeded: number[]; failed: number[] }> {
  const { partitionRejectResults } = await import("@/lib/partitionRejectResults");
  const results = await Promise.all(
    ids.map(async (id) => {
      const res = await rejectTransaction(String(id), preset, customNote);
      return { id, success: res.success };
    }),
  );
  return partitionRejectResults(results);
}

/**
 * Retroactively runs the smart matching logic for unmapped or pending review transactions.
 */
export async function batchReRunSmartMatch(projectId: string) {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);
    const projectIdParam = project?.id || null;

    // 1. Fetch project accounts
    const accounts = await getProjectAccounts(projectId);

    // 2. Fetch transactions needing re-run
    const sql = `
      SELECT id, sender_name, sender_acc_num, sender_bank, source_project_id
      FROM transactions
      WHERE (source_project_id = $1 OR $2 = true)
      AND (matching_status IS NULL OR matching_status IN ('UNMAPPED', 'PENDING_REVIEW'))
    `;
    const result = await query(sql, [projectIdParam, isAll]);
    const transactions = result.rows;

    if (transactions.length === 0) {
      return { success: true, count: 0 };
    }

    // 3. Process each transaction via state machine
    let updateCount = 0;
    for (const txn of transactions) {
      const match = runSmartMatch(
        {
          name: txn.sender_name,
          account: txn.sender_acc_num,
          bank: txn.sender_bank,
        },
        accounts,
      );

      const transition = nextState({
        current: txn.matching_status ?? "UNMAPPED",
        action: "auto_match",
        actorRole: "admin",
        score: match.score,
      });

      const newStatus = "next" in transition ? transition.next : match.status;

      const updateSql = `
        UPDATE transactions
        SET project_account_id = $1,
            matching_status = $2,
            matching_confidence = $3,
            possible_matches = $4,
            match_breakdown = $5
        WHERE id = $6
      `;
      await query(updateSql, [
        match.matchedAccountId,
        newStatus,
        match.score,
        match.possibleMatches || null,
        JSON.stringify(match.breakdown),
        txn.id,
      ]);
      updateCount++;
    }

    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    revalidatePath("/dashboard/[projectId]", "page");

    return { success: true, count: updateCount };
  } catch (error) {
    logger.error("batchReRunSmartMatch", "Failed to re-run matching", error);
    return { success: false, error: "Failed to re-run matching" };
  }
}

export interface FailedSlip {
  id: number;
  image_path: string;
  discord_message_id: string | null;
  source_project_id: number | null;
  target_project_id: number | null;
  source_project_name: string | null;
  target_project_name: string | null;
  target_date: string | null;
  created_at: string;
}

/**
 * Fetches raw_uploads rows with ai_status='ERROR', paginated.
 * Requires approve_transactions permission.
 */
export async function getFailedSlipsCount(projectId: string): Promise<number> {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);
    const res = await query(
      `SELECT COUNT(*) as total FROM raw_uploads ru
       WHERE ru.ai_status = 'ERROR'
         AND ($1 = true OR ru.source_project_id::text = $2)`,
      [isAll, project?.id || null],
    );
    return Number(res.rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

export async function getFailedSlips(
  projectId: string,
  page: number = 1,
  limit: number = 50,
  search?: string,
): Promise<{ data: FailedSlip[]; totalItems: number; totalPages: number; currentPage: number }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, 'approve_transactions')) {
    return { data: [], totalItems: 0, totalPages: 0, currentPage: page };
  }

  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);
    const projectId_ = project?.id || null;
    const OFFSET = (page - 1) * limit;
    const searchFilter = search ? `%${search}%` : null;

    const sql = `
      SELECT
        ru.id, ru.image_path, ru.discord_message_id,
        ru.source_project_id, ru.target_project_id,
        ru.target_date,
        sp.project_name AS source_project_name,
        tp.project_name AS target_project_name,
        ru.created_at
      FROM raw_uploads ru
      LEFT JOIN projects sp ON ru.source_project_id = sp.id
      LEFT JOIN projects tp ON ru.target_project_id = tp.id
      WHERE ru.ai_status = 'ERROR'
        AND ($1 = true OR ru.source_project_id::text = $2)
        AND ($5::text IS NULL OR sp.project_name ILIKE $5 OR ru.discord_message_id ILIKE $5)
      ORDER BY ru.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const countSql = `
      SELECT COUNT(*) AS total FROM raw_uploads ru
      LEFT JOIN projects sp ON ru.source_project_id = sp.id
      WHERE ru.ai_status = 'ERROR'
        AND ($1 = true OR ru.source_project_id::text = $2)
        AND ($3::text IS NULL OR sp.project_name ILIKE $3 OR ru.discord_message_id ILIKE $3)
    `;

    const [result, countRes] = await Promise.all([
      query(sql, [isAll, projectId_, limit, OFFSET, searchFilter]),
      query(countSql, [isAll, projectId_, searchFilter]),
    ]);

    const totalItems = Number(countRes.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: result.rows.map((row) => ({
        ...row,
        created_at: row.created_at?.toISOString() || "",
        target_date: row.target_date instanceof Date
          ? new Date(row.target_date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : row.target_date ?? null,
      })),
      totalItems,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    logger.error("getFailedSlips", "Failed to fetch failed slips", error);
    return { data: [], totalItems: 0, totalPages: 0, currentPage: page };
  }
}

export type { DailyBalanceRecord } from "@/types/dashboard";

// ---------------------------------------------------------------------------
// Daily balance match actions (#41)
// ---------------------------------------------------------------------------

export async function getPendingBalanceMatches(
  projectId: string,
  page: number = 1,
  limit: number = 50,
  search?: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<{
  data: import("@/types/dashboard").DailyBalanceRecord[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}> {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);
    const OFFSET = (page - 1) * limit;
    const searchFilter = search ? `%${search}%` : null;
    const fromFilter = dateFrom ?? null;
    const toFilter = dateTo ?? null;

    const sql = `
      SELECT db.*
      FROM daily_balances db
      LEFT JOIN project_accounts pa ON db.project_account_id = pa.id
      WHERE (pa.project_id = $1 OR $2 = true OR (db.project_id = $1 AND $2 = false AND pa.id IS NULL))
        AND db.matching_status IN ('PENDING_REVIEW', 'UNMATCHED')
        AND ($5::text IS NULL OR db.account_name ILIKE $5 OR db.platform ILIKE $5)
        AND ($6::date IS NULL OR db.date >= $6::date)
        AND ($7::date IS NULL OR db.date <= $7::date)
      ORDER BY db.date DESC, db.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM daily_balances db
      LEFT JOIN project_accounts pa ON db.project_account_id = pa.id
      WHERE (pa.project_id = $1 OR $2 = true OR (db.project_id = $1 AND $2 = false AND pa.id IS NULL))
        AND db.matching_status IN ('PENDING_REVIEW', 'UNMATCHED')
        AND ($3::text IS NULL OR db.account_name ILIKE $3 OR db.platform ILIKE $3)
        AND ($4::date IS NULL OR db.date >= $4::date)
        AND ($5::date IS NULL OR db.date <= $5::date)
    `;

    const [result, countRes] = await Promise.all([
      query(sql, [project?.id || null, isAll, limit, OFFSET, searchFilter, fromFilter, toFilter]),
      query(countSql, [project?.id || null, isAll, searchFilter, fromFilter, toFilter]),
    ]);

    const totalItems = Number(countRes.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalItems / limit);

    const data = result.rows.map((row) => ({
      ...row,
      id: Number(row.id),
      balance_amount: row.balance_amount !== null ? Number(row.balance_amount) : null,
      created_at: row.created_at?.toISOString() || "",
      date: row.date instanceof Date
        ? new Date(row.date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : String(row.date),
      match_breakdown: row.match_breakdown ?? null,
    }));

    return { data, totalItems, totalPages, currentPage: page };
  } catch (error) {
    logger.error("getPendingBalanceMatches", "Failed to fetch pending balance matches", error);
    return { data: [], totalItems: 0, totalPages: 0, currentPage: page };
  }
}

export async function confirmBalanceMapping(
  dailyBalanceId: number,
  projectAccountId: string,
): Promise<{ success: boolean; error?: string; warning?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "approve_transactions")) {
    return { success: false, error: "Unauthorized" };
  }

  const actor = session.user.username ?? session.user.name ?? "admin";

  try {
    // Load scanned name + target account siblings so we can self-improve
    // the alias list (ADR 0005).
    const scannedRes = await query(
      `SELECT account_name FROM daily_balances WHERE id = $1`,
      [dailyBalanceId],
    );
    const scannedName: string | null = scannedRes.rows[0]?.account_name ?? null;

    const targetRes = await query(
      `SELECT id, project_id, account_name, account_number, bank_code, aliases, aliases_meta, created_at
       FROM project_accounts WHERE id = $1`,
      [projectAccountId],
    );
    const target = targetRes.rows[0];

    let warning: string | undefined;

    if (target && scannedName) {
      const siblingsRes = await query(
        `SELECT id, project_id, account_name, account_number, bank_code, aliases, aliases_meta, created_at
         FROM project_accounts
         WHERE project_id = $1 AND deleted_at IS NULL`,
        [target.project_id],
      );
      const { proposeAliasAddition } = await import("@/lib/accountAliases");
      const proposal = proposeAliasAddition(
        target,
        scannedName,
        siblingsRes.rows,
        actor,
        dailyBalanceId,
      );

      if (proposal.ok) {
        await query(
          `UPDATE project_accounts
           SET aliases      = $1,
               aliases_meta = $2
           WHERE id = $3`,
          [JSON.stringify(proposal.aliasesNext), JSON.stringify(proposal.aliasesMetaNext), projectAccountId],
        );
      } else if (proposal.reason === "cross_master_collision") {
        const colliding = siblingsRes.rows.find((r) => r.id === proposal.collidingAccountId);
        warning = `ไม่สามารถเพิ่ม alias อัตโนมัติได้: ชื่อ "${scannedName}" ชนกับ alias ของบัญชี "${colliding?.account_name ?? proposal.collidingAccountId}"`;
      }
      // 'empty' / 'duplicate' → silent skip
    }

    await query(
      `UPDATE daily_balances
       SET project_account_id = $1,
           matching_status    = 'MANUAL_MAPPED',
           matched_by         = $2
       WHERE id = $3`,
      [projectAccountId, actor, dailyBalanceId],
    );
    revalidatePath("/dashboard/[projectId]/match", "page");
    return warning ? { success: true, warning } : { success: true };
  } catch (error) {
    logger.error("confirmBalanceMapping", "Failed to confirm balance mapping", error);
    return { success: false, error: "Failed to confirm mapping" };
  }
}

export async function batchReRunBalanceMatch(projectId: string) {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "approve_transactions")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);
    const accounts = await getProjectAccounts(projectId);

    const sql = `
      SELECT db.id, db.account_name, db.platform, db.account_number
      FROM daily_balances db
      WHERE ($2 = true OR db.project_id = $1)
        AND db.matching_status IN ('UNMATCHED', 'PENDING_REVIEW')
    `;
    const result = await query(sql, [project?.id ?? null, isAll]);
    const rows = result.rows;

    if (rows.length === 0) return { success: true, count: 0 };

    const { runBalanceMatch } = await import("@/lib/balanceMatcher");
    let updateCount = 0;

    for (const row of rows) {
      const match = runBalanceMatch(
        {
          account_name: row.account_name,
          platform: row.platform,
          account_number: row.account_number ?? null,
        },
        accounts,
      );
      await query(
        `UPDATE daily_balances
         SET project_account_id = $1,
             matching_status    = $2,
             match_breakdown    = $3
         WHERE id = $4`,
        [
          match.matchedAccountId,
          match.status,
          JSON.stringify(match.breakdown),
          row.id,
        ],
      );
      updateCount++;
    }

    revalidatePath("/dashboard/[projectId]/match", "page");
    return { success: true, count: updateCount };
  } catch (error) {
    logger.error("batchReRunBalanceMatch", "Failed to re-run balance matching", error);
    return { success: false, error: "Failed to re-run balance matching" };
  }
}

// ---------------------------------------------------------------------------
// Account Slip Drill-down (#48)
// ---------------------------------------------------------------------------

export interface AccountSlip {
  id: number | null;
  /** UUID for manual_transactions rows; null for discord slips */
  uuid_id: string | null;
  source: "discord" | "manual";
  transfer_at: string;
  sender_name: string | null;
  sender_bank: string | null;
  sender_account: string | null;
  ai_amount: number;
  adjusted_amount: number | null;
  adjusted_by: string | null;
  adjusted_at: string | null;
  adjust_note: string | null;
  ref_id: string | null;
  image_path: string | null;
  /** manual_transactions.note (admin remark). For discord slips use slip_note instead. */
  note: string | null;
  /** Bank memo OCR'd from the slip image — discord slips only (ADR 0019). */
  slip_note: string | null;
  transaction_type_id: number | null;
  transaction_subtype: string | null;
  project_account_id: string | null;
  /** Caption-derived target project id (from Discord message prefix). */
  target_project_id: number | null;
  target_project_name: string | null;
  /** Note-derived target project id (from slip_note suffix matching). */
  note_target_project_id: number | null;
  note_target_project_name: string | null;
  /** True when caption target ≠ note target — needs admin review. */
  target_conflict: boolean;
}

/**
 * Returns confirmed slips (Discord + manual) for one account on one day,
 * ordered by transfer_at ascending.
 */
export async function getAccountSlips(
  accountId: string,
  date: string,
): Promise<AccountSlip[]> {
  try {
    const discordSql = `
      SELECT
        t.id,
        NULL AS uuid_id,
        t.project_account_id,
        'discord' AS source,
        t.transfer_at,
        t.sender_name,
        t.sender_bank,
        t.sender_acc_num AS sender_account,
        t.ai_amount,
        t.adjusted_amount,
        t.adjusted_by,
        t.adjusted_at,
        t.adjust_note,
        t.ref_id,
        t.image_path,
        NULL AS note,
        t.slip_note,
        t.transaction_type_id,
        t.transaction_subtype,
        t.target_project_id,
        cp.project_name AS target_project_name,
        t.note_target_project_id,
        np.project_name AS note_target_project_name,
        t.target_conflict
      FROM transactions t
      LEFT JOIN projects cp ON t.target_project_id = cp.id
      LEFT JOIN projects np ON t.note_target_project_id = np.id
      WHERE t.project_account_id = $1
        AND (t.transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date = $2::date
        AND t.matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')
    `;

    const manualSql = `
      SELECT
        NULL AS id,
        id AS uuid_id,
        project_account_id,
        'manual' AS source,
        transfer_at,
        NULL AS sender_name,
        NULL AS sender_bank,
        NULL AS sender_account,
        amount AS ai_amount,
        NULL AS adjusted_amount,
        NULL AS adjusted_by,
        NULL AS adjusted_at,
        NULL AS adjust_note,
        NULL AS ref_id,
        image_path,
        note,
        NULL AS slip_note,
        transaction_type_id,
        transaction_subtype,
        NULL AS target_project_id,
        NULL AS target_project_name,
        NULL AS note_target_project_id,
        NULL AS note_target_project_name,
        false AS target_conflict
      FROM manual_transactions
      WHERE project_account_id = $1
        AND (transfer_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date = $2::date
    `;

    const [discordRes, manualRes] = await Promise.all([
      query(discordSql, [accountId, date]),
      query(manualSql, [accountId, date]).catch(() => ({ rows: [] })),
    ]);

    const rows = [...discordRes.rows, ...manualRes.rows];
    rows.sort((a, b) => new Date(a.transfer_at).getTime() - new Date(b.transfer_at).getTime());

    return rows.map((r) => ({
      id: r.id != null ? Number(r.id) : null,
      uuid_id: r.uuid_id ?? null,
      source: r.source as "discord" | "manual",
      transfer_at: normalizeTransferAt(r.transfer_at),
      sender_name: r.sender_name ?? null,
      sender_bank: r.sender_bank ?? null,
      sender_account: r.sender_account ?? null,
      ai_amount: Number(r.ai_amount ?? 0),
      adjusted_amount: r.adjusted_amount != null ? Number(r.adjusted_amount) : null,
      adjusted_by: r.adjusted_by ?? null,
      adjusted_at: r.adjusted_at != null
        ? (r.adjusted_at instanceof Date ? r.adjusted_at.toISOString() : String(r.adjusted_at))
        : null,
      adjust_note: r.adjust_note ?? null,
      ref_id: r.ref_id ?? null,
      image_path: r.image_path ?? null,
      note: r.note ?? null,
      slip_note: r.slip_note ?? null,
      transaction_type_id: r.transaction_type_id != null ? Number(r.transaction_type_id) : null,
      transaction_subtype: r.transaction_subtype ?? null,
      project_account_id: r.project_account_id ?? null,
      target_project_id: r.target_project_id != null ? Number(r.target_project_id) : null,
      target_project_name: r.target_project_name ?? null,
      note_target_project_id: r.note_target_project_id != null ? Number(r.note_target_project_id) : null,
      note_target_project_name: r.note_target_project_name ?? null,
      target_conflict: Boolean(r.target_conflict),
    }));
  } catch (error) {
    logger.error("getAccountSlips", "Failed to fetch account slips", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Manual Transaction Entry (#49)
// ---------------------------------------------------------------------------

/**
 * Creates a manual withdrawal transaction for a project account.
 * Counts immediately as MANUAL_MAPPED outflow in reconciliation.
 */
export async function createManualTransaction(
  projectId: string,
  projectAccountId: string,
  amount: number,
  transferAt: string,
  imagePath?: string,
  note?: string,
  transactionTypeId?: number,
  transactionSubtype?: string,
) {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    const isAll = projectId === "all";
    const projectUuid = isAll ? null : (await resolveProject(projectId))?.id;
    if (!isAll && !projectUuid) return { success: false, error: "Project not found" };

    await query(
      `INSERT INTO manual_transactions
         (project_id, project_account_id, amount, transfer_at, image_path, note, created_by,
          transaction_type_id, transaction_subtype)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        projectUuid || projectId,
        projectAccountId,
        amount,
        transferAt,
        imagePath ?? null,
        note ?? null,
        session.user.username,
        transactionTypeId ?? null,
        transactionSubtype ?? null,
      ],
    );

    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    logger.error("createManualTransaction", "Failed to create manual transaction", error);
    return { success: false, error: "Failed to create manual transaction" };
  }
}

// ---------------------------------------------------------------------------
// Manual Balance Entry (#50)
// ---------------------------------------------------------------------------

/**
 * Upserts a manual daily balance for a project account.
 * Overwrites any existing balance for the same date + account.
 */
export async function createManualBalance(
  projectAccountId: string,
  date: string,
  balanceAmount: number,
  note?: string,
  imagePath?: string,
) {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    const accountRes = await query(
      `SELECT project_id FROM project_accounts WHERE id = $1`,
      [projectAccountId],
    );
    const projectId: number | null = accountRes.rows[0]?.project_id ?? null;
    if (!projectId) return { success: false, error: "Project account not found" };

    await query(
      `INSERT INTO daily_balances
         (project_id, project_account_id, date, balance_amount, source, matching_status, matched_by, image_path)
       VALUES ($1, $2, $3::date, $4, 'manual', 'MANUAL_MAPPED', $5, $6)
       ON CONFLICT (date, project_account_id) WHERE project_account_id IS NOT NULL
         DO UPDATE SET
           balance_amount = EXCLUDED.balance_amount,
           source = 'manual',
           matching_status = 'MANUAL_MAPPED',
           matched_by = EXCLUDED.matched_by,
           image_path = EXCLUDED.image_path`,
      [projectId, projectAccountId, date, balanceAmount, session.user.username, imagePath ?? null],
    );

    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    logger.error("createManualBalance", "Failed to create manual balance", error);
    return { success: false, error: "Failed to create manual balance" };
  }
}

// ---------------------------------------------------------------------------
// Edit/Delete/Re-match daily_balances (#93)
// ---------------------------------------------------------------------------

export interface DailyBalanceChanges {
  balance_amount?: number;
  date?: string;
  note?: string | null;
  project_account_id?: string | null;
}

export async function editDailyBalance(
  id: number,
  changes: DailyBalanceChanges,
  note?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }

  const sourceRes = await query(`SELECT source FROM daily_balances WHERE id = $1`, [id]);
  const source: string = sourceRes.rows[0]?.source ?? "discord";

  const { validateEdit } = await import("@/lib/editValidation");
  const { withEditAudit } = await import("@/lib/auditFields");

  const validation = validateEdit({ table: "daily_balances", source }, Object.keys(changes));
  if (!validation.allowed) {
    return { success: false, error: validation.denyReason };
  }

  const audit = withEditAudit({}, { by: session.user.username, note });
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(changes)) {
    sets.push(`${key} = $${idx++}`);
    params.push(value);
  }
  sets.push(`last_edited_by = $${idx++}`);
  params.push(audit.last_edited_by);
  sets.push(`last_edited_at = $${idx++}`);
  params.push(audit.last_edited_at);
  if (note !== undefined) {
    sets.push(`last_edited_note = $${idx++}`);
    params.push(audit.last_edited_note ?? null);
  }
  params.push(id);

  try {
    await query(`UPDATE daily_balances SET ${sets.join(", ")} WHERE id = $${idx}`, params);
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    revalidatePath("/dashboard/[projectId]/match", "page");
    return { success: true };
  } catch (error) {
    logger.error("editDailyBalance", "Failed to edit daily balance", error);
    return { success: false, error: "Failed to edit daily balance" };
  }
}

export async function deleteDailyBalance(
  id: number,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }
  if (!reason.trim()) {
    return { success: false, error: "Delete reason is required" };
  }

  const { withDeleteAudit } = await import("@/lib/auditFields");
  const audit = withDeleteAudit({ by: session.user.username, reason });

  try {
    await query("BEGIN");
    await query(
      `UPDATE daily_balances
          SET deleted_at = $1, deleted_by = $2, delete_reason = $3
        WHERE id = $4`,
      [audit.deleted_at, audit.deleted_by, audit.delete_reason, id],
    );
    await query(`DELETE FROM daily_balances WHERE id = $1`, [id]);
    await query("COMMIT");
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    revalidatePath("/dashboard/[projectId]/match", "page");
    return { success: true };
  } catch (error) {
    await query("COMMIT").catch(() => {});
    logger.error("deleteDailyBalance", "Failed to delete daily balance", error);
    return { success: false, error: "Failed to delete daily balance" };
  }
}

export async function rematchDailyBalance(
  id: number,
  projectAccountId: string,
): Promise<{ success: boolean; error?: string; warning?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }

  const actor = session.user.username ?? session.user.name ?? "admin";

  try {
    // Load scanned name for alias auto-append (same as confirmBalanceMapping)
    const scannedRes = await query(
      `SELECT account_name FROM daily_balances WHERE id = $1`,
      [id],
    );
    const scannedName: string | null = scannedRes.rows[0]?.account_name ?? null;

    const targetRes = await query(
      `SELECT id, project_id, account_name, account_number, bank_code, aliases, aliases_meta, created_at
       FROM project_accounts WHERE id = $1`,
      [projectAccountId],
    );
    const target = targetRes.rows[0];

    let warning: string | undefined;

    if (target && scannedName) {
      const siblingsRes = await query(
        `SELECT id, project_id, account_name, account_number, bank_code, aliases, aliases_meta, created_at
         FROM project_accounts
         WHERE project_id = $1 AND deleted_at IS NULL`,
        [target.project_id],
      );
      const { proposeAliasAddition } = await import("@/lib/accountAliases");
      const proposal = proposeAliasAddition(target, scannedName, siblingsRes.rows, actor, id);
      if (proposal.ok) {
        await query(
          `UPDATE project_accounts SET aliases = $1, aliases_meta = $2 WHERE id = $3`,
          [JSON.stringify(proposal.aliasesNext), JSON.stringify(proposal.aliasesMetaNext), projectAccountId],
        );
      } else if (proposal.reason === "cross_master_collision") {
        const colliding = siblingsRes.rows.find((r) => r.id === proposal.collidingAccountId);
        warning = `ไม่สามารถเพิ่ม alias อัตโนมัติได้: ชื่อ "${scannedName}" ชนกับ alias ของบัญชี "${colliding?.account_name ?? proposal.collidingAccountId}"`;
      }
    }

    await query(
      `UPDATE daily_balances
         SET project_account_id = $1,
             matching_status    = 'MANUAL_MAPPED',
             matched_by         = $2,
             last_edited_by     = $2,
             last_edited_at     = NOW()
       WHERE id = $3`,
      [projectAccountId, actor, id],
    );
    revalidatePath("/dashboard/[projectId]/match", "page");
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return warning ? { success: true, warning } : { success: true };
  } catch (error) {
    logger.error("rematchDailyBalance", "Failed to re-match daily balance", error);
    return { success: false, error: "Failed to re-match daily balance" };
  }
}

export type BalanceRejectPreset = "ยอดซ้ำ" | "บัญชีผิด" | "วันที่ผิด" | "ยอดผิดพลาด" | "อื่นๆ";

export async function rejectDailyBalance(
  id: number,
  preset: BalanceRejectPreset,
  customNote?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!["owner", "admin"].includes(session.user.role ?? "")) {
    return { success: false, error: "Unauthorized" };
  }

  const reason = preset === "อื่นๆ" ? (customNote ?? "อื่นๆ") : preset;

  try {
    await query(
      `UPDATE daily_balances
         SET matching_status = 'REJECTED',
             reject_reason   = $1,
             rejected_by     = $2,
             rejected_at     = NOW()
       WHERE id = $3
         AND matching_status IN ('UNMATCHED', 'PENDING_REVIEW')`,
      [reason, session.user.username, id],
    );
    revalidatePath("/dashboard/[projectId]/match", "page");
    return { success: true };
  } catch (error) {
    logger.error("rejectDailyBalance", "Failed to reject daily balance", error);
    return { success: false, error: "Failed to reject daily balance" };
  }
}

export async function getDailyBalanceForAccountDate(
  projectAccountId: string,
  date: string,
): Promise<{ id: number; source: string; matching_status: string } | null> {
  try {
    const res = await query(
      `SELECT id, source, matching_status
         FROM daily_balances
        WHERE project_account_id = $1 AND date = $2::date
        LIMIT 1`,
      [projectAccountId, date],
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return { id: Number(r.id), source: String(r.source), matching_status: String(r.matching_status) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Slip Adjustment (#57)
// ---------------------------------------------------------------------------

/**
 * Corrects the AI-extracted amount on a Discord slip.
 * Pass adjustedAmount=null to revert to the original ai_amount.
 * Requires owner or admin role.
 */
export async function adjustTransactionAmount(
  transactionId: number,
  adjustedAmount: number | null,
  note: string | null,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    if (adjustedAmount !== null) {
      await query(
        `UPDATE transactions
         SET adjusted_amount = $1, adjusted_by = $2, adjusted_at = NOW(), adjust_note = $3,
             last_edited_by = $2, last_edited_at = NOW()
         WHERE id = $4`,
        [adjustedAmount, session.user.username, note ?? null, transactionId],
      );
    } else {
      await query(
        `UPDATE transactions
         SET adjusted_amount = NULL, adjusted_by = NULL, adjusted_at = NULL, adjust_note = NULL,
             last_edited_by = $1, last_edited_at = NOW()
         WHERE id = $2`,
        [session.user.username, transactionId],
      );
    }
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    logger.error("adjustTransactionAmount", "Failed to adjust transaction amount", error);
    return { success: false, error: "Failed to adjust transaction amount" };
  }
}

// ---------------------------------------------------------------------------
// Edit Discord Slip Metadata (#92)
// ---------------------------------------------------------------------------

export interface TransactionChanges {
  transfer_at?: string;
  transaction_type_id?: number | null;
  transaction_subtype?: string | null;
  project_account_id?: string | null;
}

export async function editTransaction(
  id: number,
  changes: TransactionChanges,
  note?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }

  const { validateEdit } = await import("@/lib/editValidation");
  const { withEditAudit } = await import("@/lib/auditFields");

  const validation = validateEdit({ table: "transactions" }, Object.keys(changes));
  if (!validation.allowed) {
    return { success: false, error: validation.denyReason };
  }

  const audit = withEditAudit({}, { by: session.user.username, note });
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(changes)) {
    sets.push(`${key} = $${idx++}`);
    params.push(value);
  }
  sets.push(`last_edited_by = $${idx++}`);
  params.push(audit.last_edited_by);
  sets.push(`last_edited_at = $${idx++}`);
  params.push(audit.last_edited_at);
  if (note !== undefined) {
    sets.push(`last_edited_note = $${idx++}`);
    params.push(audit.last_edited_note ?? null);
  }
  params.push(id);

  try {
    await query(
      `UPDATE transactions SET ${sets.join(", ")} WHERE id = $${idx}`,
      params,
    );
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    revalidatePath("/dashboard/[projectId]/match", "page");
    return { success: true };
  } catch (error) {
    logger.error("editTransaction", "Failed to edit transaction", error);
    return { success: false, error: "Failed to edit transaction" };
  }
}

/**
 * Marks a raw_upload as PROCESSED after successful manual entry.
 */
export async function markUploadProcessed(uploadId: number) {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, 'approve_transactions')) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    await query(
      "UPDATE raw_uploads SET ai_status = 'PROCESSED' WHERE id = $1",
      [uploadId],
    );
    revalidatePath("/dashboard/[projectId]", "page");
    return { success: true };
  } catch (error) {
    logger.error("markUploadProcessed", "Failed to mark upload processed", error);
    return { success: false, error: "Failed to update upload status" };
  }
}

export async function rejectUpload(uploadId: number) {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, 'approve_transactions')) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    await query(
      "UPDATE raw_uploads SET ai_status = 'REJECTED' WHERE id = $1",
      [uploadId],
    );
    revalidatePath("/dashboard/[projectId]/match", "page");
    return { success: true };
  } catch (error) {
    logger.error("rejectUpload", "Failed to reject upload", error);
    return { success: false, error: "Failed to reject upload" };
  }
}

// ---------------------------------------------------------------------------
// Transaction Types (#74)
// ---------------------------------------------------------------------------

export interface TransactionType {
  id: number;
  project_id: number | null;
  name: string;
  created_by: string | null;
  created_at: string;
}

/**
 * Returns global types merged with project-scoped types, global first.
 */
export async function listTransactionTypes(projectId: string): Promise<TransactionType[]> {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);
    const projectUuid = project?.id ?? null;

    const sql = projectUuid
      ? `SELECT id, project_id, name, created_by, created_at
           FROM transaction_types
          WHERE project_id IS NULL OR project_id = $1
          ORDER BY project_id NULLS FIRST, name`
      : `SELECT id, project_id, name, created_by, created_at
           FROM transaction_types
          WHERE project_id IS NULL
          ORDER BY name`;

    const res = await query(sql, projectUuid ? [projectUuid] : []);
    return res.rows.map((r) => ({
      id: Number(r.id),
      project_id: r.project_id != null ? Number(r.project_id) : null,
      name: String(r.name),
      created_by: r.created_by ?? null,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  } catch (error) {
    logger.error("listTransactionTypes", "Failed to list transaction types", error);
    return [];
  }
}

export async function createTransactionType(
  projectId: string,
  name: string,
): Promise<{ success: boolean; id?: number; error?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Name is required" };

  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await resolveProject(projectId);
    const projectUuid = project?.id ?? null;

    const res = await query(
      `INSERT INTO transaction_types (project_id, name, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [projectUuid, trimmed, session.user.username],
    );
    revalidatePath("/dashboard/[projectId]/accounts", "page");
    return { success: true, id: Number(res.rows[0].id) };
  } catch (error) {
    logger.error("createTransactionType", "Failed to create transaction type", error);
    return { success: false, error: "Failed to create transaction type" };
  }
}

export async function deleteTransactionType(
  typeId: number,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    // Block delete if any slip references this type
    const refCheck = await query(
      `SELECT 1 FROM transactions WHERE transaction_type_id = $1
        UNION ALL
       SELECT 1 FROM manual_transactions WHERE transaction_type_id = $1
       LIMIT 1`,
      [typeId],
    );
    if ((refCheck.rowCount ?? 0) > 0) {
      return { success: false, error: "ไม่สามารถลบได้ — มี slip อ้างอิง type นี้อยู่" };
    }
    await query("DELETE FROM transaction_types WHERE id = $1", [typeId]);
    revalidatePath("/dashboard/[projectId]/accounts", "page");
    return { success: true };
  } catch (error) {
    logger.error("deleteTransactionType", "Failed to delete transaction type", error);
    return { success: false, error: "Failed to delete transaction type" };
  }
}

// ---------------------------------------------------------------------------
// Slip Type Editor (#78)
// ---------------------------------------------------------------------------

/**
 * Updates transaction_type_id and transaction_subtype on a single slip.
 * Works for both 'discord' (transactions table) and 'manual' (manual_transactions table).
 * Requires manage_projects permission.
 */
export async function updateSlipType(
  source: "discord" | "manual",
  id: number,
  typeId: number | null,
  subtype: string | null,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    const table = source === "discord" ? "transactions" : "manual_transactions";
    await query(
      `UPDATE ${table} SET transaction_type_id = $1, transaction_subtype = $2 WHERE id = $3`,
      [typeId, subtype || null, id],
    );
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    logger.error("updateSlipType", "Failed to update slip type", error);
    return { success: false, error: "Failed to update slip type" };
  }
}

/**
 * Resolves a cross-project target conflict by setting the admin-chosen target
 * and clearing the conflict flag. Discord slips only.
 */
export async function updateSlipTargetProject(
  slipId: number,
  targetProjectId: number,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    await query(
      `UPDATE transactions SET target_project_id = $1, target_conflict = false WHERE id = $2`,
      [targetProjectId, slipId],
    );
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    logger.error("updateSlipTargetProject", "Failed to update target project", error);
    return { success: false, error: "Failed to update target project" };
  }
}

/**
 * Returns distinct non-null transaction_subtype values across both slip tables.
 * Used for autocomplete in the slip type editor.
 */
// ---------------------------------------------------------------------------
// Edit/Delete Manual Transactions (#91)
// ---------------------------------------------------------------------------

export interface ManualTransactionChanges {
  amount?: number;
  transfer_at?: string;
  project_account_id?: string;
  transaction_type_id?: number | null;
  transaction_subtype?: string | null;
  note?: string | null;
  image_path?: string | null;
}

export async function editManualTransaction(
  id: string,
  changes: ManualTransactionChanges,
  note?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }

  const { validateEdit } = await import("@/lib/editValidation");
  const { withEditAudit } = await import("@/lib/auditFields");

  const validation = validateEdit({ table: "manual_transactions" }, Object.keys(changes));
  if (!validation.allowed) {
    return { success: false, error: validation.denyReason };
  }

  const audit = withEditAudit({}, { by: session.user.username, note });
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(changes)) {
    sets.push(`${key} = $${idx++}`);
    params.push(value);
  }
  sets.push(`last_edited_by = $${idx++}`);
  params.push(audit.last_edited_by);
  sets.push(`last_edited_at = $${idx++}`);
  params.push(audit.last_edited_at);
  if (note !== undefined) {
    sets.push(`last_edited_note = $${idx++}`);
    params.push(audit.last_edited_note ?? null);
  }
  params.push(id);

  try {
    await query(
      `UPDATE manual_transactions SET ${sets.join(", ")} WHERE id = $${idx}`,
      params,
    );
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    logger.error("editManualTransaction", "Failed to edit manual transaction", error);
    return { success: false, error: "Failed to edit manual transaction" };
  }
}

export async function deleteManualTransaction(
  id: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return { success: false, error: "Unauthorized" };
  }

  if (!reason.trim()) {
    return { success: false, error: "Delete reason is required" };
  }

  const { withDeleteAudit } = await import("@/lib/auditFields");
  const audit = withDeleteAudit({ by: session.user.username, reason });

  try {
    // Stamp audit columns then hard-delete in one transaction
    await query("BEGIN");
    await query(
      `UPDATE manual_transactions
          SET deleted_at = $1, deleted_by = $2, delete_reason = $3
        WHERE id = $4`,
      [audit.deleted_at, audit.deleted_by, audit.delete_reason, id],
    );
    await query(`DELETE FROM manual_transactions WHERE id = $1`, [id]);
    await query("COMMIT");
    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    await query("COMMIT").catch(() => {});
    logger.error("deleteManualTransaction", "Failed to delete manual transaction", error);
    return { success: false, error: "Failed to delete manual transaction" };
  }
}

export async function listSlipSubtypes(): Promise<string[]> {
  try {
    const res = await query(
      `SELECT DISTINCT transaction_subtype AS subtype
         FROM (
           SELECT transaction_subtype FROM transactions WHERE transaction_subtype IS NOT NULL
           UNION ALL
           SELECT transaction_subtype FROM manual_transactions WHERE transaction_subtype IS NOT NULL
         ) combined
         ORDER BY subtype`,
    );
    return res.rows.map((r) => String(r.subtype));
  } catch {
    return [];
  }
}

export async function rematchParkingWithdrawals(projectId: string): Promise<{ matched: number }> {
  const session = await getServerAuthSession();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "admin")) throw new Error("Forbidden");

  const res = await query(
    `UPDATE gateway_parking_withdrawals gpw
     SET project_account_id = pa.id
     FROM project_accounts pa
     WHERE gpw.project_account_id IS NULL
       AND gpw.project_id = $1
       AND pa.project_id = $1
       AND pa.deleted_at IS NULL
       AND (
         (
           regexp_replace(COALESCE(pa.account_number, ''), '[^0-9]', '', 'g')
             = regexp_replace(COALESCE(gpw.account_number, ''), '[^0-9]', '', 'g')
           AND regexp_replace(COALESCE(gpw.account_number, ''), '[^0-9]', '', 'g') <> ''
         )
         OR (
           gpw.account_name IS NOT NULL AND gpw.account_name <> ''
           AND gpw.account_name = pa.account_name
         )
       )`,
    [projectId],
  );

  revalidatePath(`/dashboard/${projectId}`);
  return { matched: res.rowCount ?? 0 };
}
