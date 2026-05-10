"use server";

import { query } from "@/lib/db";
import { subDays, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { runSmartMatch } from "@/lib/smartMatcher";
import { getServerAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { computeKpi } from "@/lib/reconciliationFormula";
import { nextState } from "@/lib/transactionState";
import { buildTransferAt } from "@/lib/transferAt";
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
 * Aggregates results by formatted account name and sorts by total DESC.
 */
function aggregateBreakdown(rows: any[]): AccountBreakdown[] {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const rawAccount = row.account || "Unknown";
    const formattedName = formatAccountName(rawAccount);
    const amount = Number(row.total || 0);

    map.set(formattedName, (map.get(formattedName) || 0) + amount);
  });

  return Array.from(map.entries())
    .map(([account, total]) => ({ account, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Formats account names from "ID | Name" to "Name (ID)".
 */
function formatAccountName(webAcc: string): string {
  const trimmed = webAcc.trim();

  // Pattern 1: Pipe (ID | Name) -> Name (ID)
  if (trimmed.includes("|")) {
    const [id, name] = trimmed.split("|").map((s) => s.trim());
    return name ? `${name} (${id})` : id;
  }

  // Pattern 3: Numeric only -> Default Bank (Account)
  if (/^\d+$/.test(trimmed)) {
    return `ธนาคารไทยพาณิชย์ (${trimmed})`;
  }

  // Pattern 2: Combined (DigitsText) -> Text (Digits)
  const combinedMatch = trimmed.match(/^(\d+)(.+)$/);
  if (combinedMatch) {
    const [, id, name] = combinedMatch;
    return `${name.trim()} (${id.trim()})`;
  }

  return trimmed;
}

/**
 * Resolves a project identifier (from the URL) to its UUID AND canonical name.
 */
async function getProjectIdentifiers(
  projectName: string,
): Promise<{ id: string; name: string } | null> {
  if (projectName === "all" || !projectName) return null;
  try {
    logger.debug(
      "getProjectIdentifiers",
      `Resolving identifiers for projectName: ${projectName}`,
    );
    const result = await query(
      "SELECT id, project_name FROM projects WHERE project_name ILIKE '%' || $1 || '%' AND status = 'ACTIVE' LIMIT 1",
      [projectName],
    );
    logger.debug("getProjectIdentifiers", "Resolve result", result.rows[0]);
    if (!result.rows[0]) return null;
    return {
      id: result.rows[0].id,
      name: result.rows[0].project_name,
    };
  } catch (error) {
    logger.error(
      "getProjectIdentifiers",
      `Failed to resolve identifiers for project: ${projectName}`,
      error,
    );
    return null;
  }
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
      "SELECT id, project_name FROM projects WHERE status = 'ACTIVE' ORDER BY project_name ASC";
    const result = await query(sql);
    const projects: ProjectOption[] = result.rows.map((row) => ({
      id: row.id,
      name: row.project_name,
      color: projectColor(row.project_name),
    }));
    return [
      { id: "all", name: "ทุกโปรเจกต์", color: "bg-gray-700" },
      ...projects,
    ];
  } catch (error) {
    logger.error("getProjectOptions", "Failed to fetch project options", error);
    return [{ id: "all", name: "ทุกโปรเจกต์", color: "bg-gray-700" }];
  }
}

/**
 * Fetches a single project's details by its Name (from URL).
 */
export async function getProjectByName(
  name: string,
): Promise<{ id: string; project_name: string } | null> {
  if (name === "all") return { id: "all", project_name: "ทุกโปรเจกต์" };
  try {
    const result = await query(
      "SELECT id, project_name FROM projects WHERE project_name ILIKE '%' || $1 || '%' AND status = 'ACTIVE' LIMIT 1",
      [name],
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error(
      "getProjectByName",
      `Failed to fetch project by name: ${name}`,
      error,
    );
    return null;
  }
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

    // Resolve identifiers
    const project = isAll ? null : await getProjectIdentifiers(projectId);
    if (!isAll && !project) {
      return {
        totalDeposits: 0,
        totalWithdrawals: 0,
        latestBalance: 0,
        deposit: 0,
        manualIn: 0,
        bonus: 0,
        fixedDeposit: 0,
        withdraw: 0,
        manualOut: 0,
        redeem: 0,
        affiliate: 0,
        cashback: 0,
        depositBreakdown: [],
        withdrawalBreakdown: [],
      };
    }

    // Query for deposits and withdrawals in the given range
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(deposit + manual_in + bonus + fixed_deposit), 0) as total_deposits,
        COALESCE(SUM(withdraw + manual_out + redeem + affiliate + cashback), 0) as total_withdrawals,
        COALESCE(SUM(deposit), 0) as deposit,
        COALESCE(SUM(manual_in), 0) as manual_in,
        COALESCE(SUM(bonus), 0) as bonus,
        COALESCE(SUM(fixed_deposit), 0) as fixed_deposit,
        COALESCE(SUM(withdraw), 0) as withdraw,
        COALESCE(SUM(manual_out), 0) as manual_out,
        COALESCE(SUM(redeem), 0) as redeem,
        COALESCE(SUM(affiliate), 0) as affiliate,
        COALESCE(SUM(cashback), 0) as cashback
      FROM report_summary_daily
      WHERE (project_id ILIKE '%' || $1 || '%' OR $2 = true)
      AND report_date::date BETWEEN $3 AND $4
    `;

    // Query for the latest balance
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
        WHERE project_id ILIKE '%' || $1 || '%' 
        AND report_date <= $2
        ORDER BY report_date DESC 
        LIMIT 1
      `;

    // Query for breakdowns by account (web_acc)
    const depositsBreakdownQuery = `
      SELECT web_acc as account, COALESCE(SUM(amount), 0) as total
      FROM report_deposits
      WHERE trans_date::date BETWEEN $1 AND $2
      AND status = 'สำเร็จ'
      GROUP BY web_acc
      ORDER BY total DESC
    `;

    const withdrawalsBreakdownQuery = `
      SELECT web_acc as account, COALESCE(SUM(amount), 0) as total
      FROM report_withdrawals
      WHERE trans_date::date BETWEEN $1 AND $2
      AND status = 'สำเร็จ'
      GROUP BY web_acc
      ORDER BY total DESC
    `;

    const reportDepositsQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_deposits
      FROM report_deposits
      WHERE status = 'สำเร็จ'
      AND trans_date::date BETWEEN $1 AND $2
    `;

    logger.debug(
      "getDashboardSummary",
      `Resolved project for projectId: ${projectId}`,
      project,
    );
    const projectName = project?.name || "";
    const projectIdParam = project?.id || null;
    const summaryParams = [projectName, isAll, startDate, endDate];
    const breakdownParams = [startDate, endDate];

    const [
      summaryRes,
      balanceRes,
      depositsRes,
      withdrawalsRes,
      txDepositRes,
    ] = await Promise.all([
      query(summaryQuery, summaryParams),
      query(balanceQuery, isAll ? [endDate] : [projectName, endDate]),
      query(depositsBreakdownQuery, breakdownParams),
      query(withdrawalsBreakdownQuery, breakdownParams),
      query(reportDepositsQuery, [startDate, endDate]),
    ]);

    const trueTotalDeposits = Number(txDepositRes.rows[0]?.total_deposits || 0);
    const trueTotalWithdrawals = Number(summaryRes.rows[0]?.total_withdrawals || 0);

    return {
      totalDeposits: trueTotalDeposits,
      totalWithdrawals: trueTotalWithdrawals,
      latestBalance: Number(balanceRes.rows[0]?.latest_balance || 0),
      deposit: trueTotalDeposits,
      manualIn: Number(summaryRes.rows[0].manual_in || 0),
      bonus: Number(summaryRes.rows[0].bonus || 0),
      fixedDeposit: Number(summaryRes.rows[0].fixed_deposit || 0),
      withdraw: Number(summaryRes.rows[0].withdraw || 0),
      manualOut: Number(summaryRes.rows[0].manual_out || 0),
      redeem: Number(summaryRes.rows[0].redeem || 0),
      affiliate: Number(summaryRes.rows[0].affiliate || 0),
      cashback: Number(summaryRes.rows[0].cashback || 0),
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
      bonus: 0,
      fixedDeposit: 0,
      withdraw: 0,
      manualOut: 0,
      redeem: 0,
      affiliate: 0,
      cashback: 0,
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
    const isAll = projectId === "all";
    const { startDate, endDate } = getDateRange(from, to);

    const project = isAll ? null : await getProjectIdentifiers(projectId);
    if (!isAll && !project) return [];

    // Fetch all KPI columns so computeKpi can apply the canonical formula.
    const sql = `
      SELECT
        report_date::date::text AS report_date,
        project_id,
        COALESCE(deposit, 0) AS deposit,
        COALESCE(manual_in, 0) AS manual_in,
        COALESCE(bonus, 0) AS bonus,
        COALESCE(fixed_deposit, 0) AS fixed_deposit,
        COALESCE(withdraw, 0) AS withdraw,
        COALESCE(manual_out, 0) AS manual_out,
        COALESCE(redeem, 0) AS redeem,
        COALESCE(affiliate, 0) AS affiliate,
        COALESCE(cashback, 0) AS cashback,
        COALESCE(balance, 0) AS balance
      FROM report_summary_daily
      WHERE (project_id ILIKE '%' || $1 || '%' OR $2 = true)
        AND report_date::date BETWEEN $3 AND $4
      ORDER BY report_date ASC
    `;

    const projectName = project?.name || "";
    logger.debug("getDailyChartData", `Fetching chart data`, { projectId, projectName, startDate, endDate });
    const result = await query(sql, [projectName, isAll, startDate, endDate]);

    const { byDay } = computeKpi(result.rows);

    return byDay.map(({ date, deposits, withdrawals, netDiff }) => ({
      day: (() => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return "N/A";
        return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
      })(),
      deposits,
      withdrawals,
      netDiff,
      date,
    }));
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
    const project = isAll ? null : await getProjectIdentifiers(projectId);

    // Consistent with other queries, we match by project name/slug
    const projectName = project?.name || projectId;

    const sql = `
      SELECT id, project_id, account_name, account_number, bank_code, aliases, created_at
      FROM project_accounts
      WHERE (project_id ILIKE '%' || $1 || '%' OR $2 = true)
      ORDER BY account_name ASC
    `;

    const result = await query(sql, [projectName, isAll]);

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

export interface OcrResultInput {
  source_project_id: string;
  target_project_id: string;
  amount: number;
  ai_amount: number;
  sender_name: string;
  sender_account: string;
  sender_bank: string;
  receiver_name: string;
  /** naive local timestamp, e.g. "2026-01-15 14:30:00" — use buildTransferAt() to construct */
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
export async function getPendingMatchCount(projectId: string): Promise<number> {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await getProjectIdentifiers(projectId);
    const res = await query(
      `SELECT COUNT(*) as total FROM transactions
       WHERE (source_project_id = $1 OR $2 = true)
       AND matching_status IN ('PENDING_REVIEW', 'UNMAPPED')`,
      [project?.id || null, isAll],
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
): Promise<{
  data: TransactionRecord[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}> {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await getProjectIdentifiers(projectId);

    const OFFSET = (page - 1) * limit;

    const sql = `
      SELECT t.*, p.project_name
      FROM transactions t
      LEFT JOIN projects p ON t.source_project_id = p.id
      WHERE (t.source_project_id = $1 OR $2 = true)
      AND t.matching_status IN ('PENDING_REVIEW', 'UNMAPPED')
      ORDER BY t.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM transactions t
      WHERE (t.source_project_id = $1 OR $2 = true)
      AND t.matching_status IN ('PENDING_REVIEW', 'UNMAPPED')
    `;

    const [result, countRes] = await Promise.all([
      query(sql, [project?.id || null, isAll, limit, OFFSET]),
      query(countSql, [project?.id || null, isAll]),
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

/**
 * Retroactively runs the smart matching logic for unmapped or pending review transactions.
 */
export async function batchReRunSmartMatch(projectId: string) {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await getProjectIdentifiers(projectId);
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
  created_at: string;
}

/**
 * Fetches raw_uploads rows with ai_status='ERROR', paginated.
 * Requires approve_transactions permission.
 */
export async function getFailedSlips(
  projectId: string,
  page: number = 1,
  limit: number = 50,
): Promise<{ data: FailedSlip[]; totalItems: number; totalPages: number; currentPage: number }> {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, 'approve_transactions')) {
    return { data: [], totalItems: 0, totalPages: 0, currentPage: page };
  }

  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await getProjectIdentifiers(projectId);
    const projectId_ = project?.id || null;
    const OFFSET = (page - 1) * limit;

    const sql = `
      SELECT
        ru.id, ru.image_path, ru.discord_message_id,
        ru.source_project_id, ru.target_project_id,
        sp.project_name AS source_project_name,
        tp.project_name AS target_project_name,
        ru.created_at
      FROM raw_uploads ru
      LEFT JOIN projects sp ON ru.source_project_id = sp.id
      LEFT JOIN projects tp ON ru.target_project_id = tp.id
      WHERE ru.ai_status = 'ERROR'
        AND ($1 = true OR ru.source_project_id::text = $2)
      ORDER BY ru.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const countSql = `
      SELECT COUNT(*) AS total FROM raw_uploads ru
      WHERE ru.ai_status = 'ERROR'
        AND ($1 = true OR ru.source_project_id::text = $2)
    `;

    const [result, countRes] = await Promise.all([
      query(sql, [isAll, projectId_, limit, OFFSET]),
      query(countSql, [isAll, projectId_]),
    ]);

    const totalItems = Number(countRes.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: result.rows.map((row) => ({
        ...row,
        created_at: row.created_at?.toISOString() || "",
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
