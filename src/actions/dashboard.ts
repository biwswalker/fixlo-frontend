"use server";

import { query } from "@/lib/db";
import { subDays, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { runSmartMatch } from "@/lib/smartMatcher";
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



    logger.debug(
      "getDashboardSummary",
      `Resolved project for projectId: ${projectId}`,
      project,
    );
    const projectName = project?.name || "";
    const summaryParams = [projectName, isAll, startDate, endDate];
    const breakdownParams = [startDate, endDate];

    const [
      summaryRes,
      balanceRes,
      depositsRes,
      withdrawalsRes,
    ] = await Promise.all([
      query(summaryQuery, summaryParams),
      query(balanceQuery, isAll ? [endDate] : [projectName, endDate]),
      query(depositsBreakdownQuery, breakdownParams),
      query(withdrawalsBreakdownQuery, breakdownParams),
    ]);

    const trueTotalDeposits = Number(summaryRes.rows[0]?.total_deposits || 0);
    const trueTotalWithdrawals = Number(summaryRes.rows[0]?.total_withdrawals || 0);

    return {
      totalDeposits: trueTotalDeposits,
      totalWithdrawals: trueTotalWithdrawals,
      latestBalance: Number(balanceRes.rows[0]?.latest_balance || 0),
      deposit: Number(summaryRes.rows[0].deposit || 0),
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

    const sql = `
      SELECT 
        report_date, 
        SUM(COALESCE(deposit, 0) + COALESCE(manual_in, 0) + COALESCE(bonus, 0) + COALESCE(fixed_deposit, 0)) as deposits,
        SUM(COALESCE(withdraw, 0) + COALESCE(manual_out, 0) + COALESCE(redeem, 0) + COALESCE(affiliate, 0) + COALESCE(cashback, 0)) as withdrawals,
        SUM((COALESCE(deposit, 0) + COALESCE(manual_in, 0) + COALESCE(bonus, 0) + COALESCE(fixed_deposit, 0)) - 
            (COALESCE(withdraw, 0) + COALESCE(manual_out, 0) + COALESCE(redeem, 0) + COALESCE(affiliate, 0) + COALESCE(cashback, 0))) as net_diff
      FROM report_summary_daily
      WHERE (project_id ILIKE '%' || $1 || '%' OR $2 = true)
      AND report_date::date BETWEEN $3 AND $4
      GROUP BY report_date
      ORDER BY report_date ASC
    `;

    const projectName = project?.name || "";
    logger.debug("getDailyChartData", `Fetching chart data`, {
      projectId,
      projectName,
      startDate,
      endDate,
    });
    const result = await query(sql, [projectName, isAll, startDate, endDate]);

    return result.rows.map((row) => ({
      day: (() => {
        const d = new Date(row.report_date);
        if (isNaN(d.getTime())) return "N/A";
        return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
      })(),
      deposits: Number(row.deposits),
      withdrawals: Number(row.withdrawals),
      netDiff: Number(row.net_diff),
      date:
        typeof row.report_date === "string"
          ? row.report_date
          : row.report_date.toISOString().split("T")[0],
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

export interface ReconciliationStatus {
  todayBalance: number;
  yesterdayBalance: number;
  totalWithdrawals: number;
  totalDeposits: number;
  variance: number;
  targetDate: string;
}

/**
 * Calculates the reconciliation status based on the accounting equation.
 */
export async function getReconciliationStatus(
  projectId: string,
  targetDate: string,
): Promise<ReconciliationStatus> {
  try {
    const isAll = projectId === "all";
    const project = isAll ? null : await getProjectIdentifiers(projectId);
    if (!isAll && !project) {
      return {
        todayBalance: 0,
        yesterdayBalance: 0,
        totalWithdrawals: 0,
        totalDeposits: 0,
        variance: 0,
        targetDate,
      };
    }

    // 1. Fetch Today's Balance
    const todayBalanceSql = `
      SELECT COALESCE(SUM(db.balance_amount), 0) as total 
      FROM daily_balances db
      JOIN projects p ON db.project_name = p.project_name
      WHERE (p.project_name ILIKE '%' || $1 || '%' OR $2 = true)
      AND db.date = $3
    `;

    // 2. Fetch Yesterday's Balance (Most recent before targetDate)
    const yesterdayBalanceSql = isAll
      ? `
        SELECT COALESCE(SUM(balance_amount), 0) as total 
        FROM (
          SELECT DISTINCT ON (project_name) balance_amount 
          FROM daily_balances 
          WHERE date < $1
          ORDER BY project_name, date DESC
        ) as prev_balances
      `
      : `
        SELECT COALESCE(db.balance_amount, 0) as total 
        FROM daily_balances db
        JOIN projects p ON db.project_name = p.project_name
        WHERE p.project_name ILIKE '%' || $1 || '%' AND db.date < $2
        ORDER BY db.date DESC LIMIT 1
      `;

    // 3. Fetch withdrawals from transactions table
    const withdrawalsSql = `
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE (source_project_id = $1 OR $2 = true)
      AND transfer_date = $3
      AND matching_status IN ('AUTO_MAPPED', 'MANUAL_MAPPED')
    `;

    // 4. Fetch deposits from report_summary_daily
    const depositsSql = `
      SELECT COALESCE(SUM(deposit), 0) as total 
      FROM report_summary_daily 
      WHERE (project_id ILIKE '%' || $1 || '%' OR $2 = true)
      AND report_date = $3
    `;

    const projectName = project?.name || "";
    const projectIdParam = project?.id || null;
    logger.debug("getReconciliationStatus", `Fetching reconciliation status`, {
      projectId,
      uuid: projectIdParam,
      projectName,
      targetDate,
    });

    const [todayRes, yesterdayRes, withdrawalsRes, depositsRes] =
      await Promise.all([
        query(todayBalanceSql, [projectName, isAll, targetDate]),
        query(
          yesterdayBalanceSql,
          isAll ? [targetDate] : [projectName, targetDate],
        ),
        query(withdrawalsSql, [projectIdParam, isAll, targetDate]),
        query(depositsSql, [projectName, isAll, targetDate]),
      ]);

    const todayBalance = Number(todayRes.rows[0]?.total || 0);
    const yesterdayBalance = Number(yesterdayRes.rows[0]?.total || 0);
    const totalWithdrawals = Number(withdrawalsRes.rows[0]?.total || 0);
    const totalDeposits = Number(depositsRes.rows[0]?.total || 0);

    // Equation: Variance = ((Today - Yesterday) + Withdrawals) - Deposits
    const variance =
      todayBalance - yesterdayBalance + totalWithdrawals - totalDeposits;

    return {
      todayBalance,
      yesterdayBalance,
      totalWithdrawals,
      totalDeposits,
      variance,
      targetDate,
    };
  } catch (error) {
    logger.error(
      "getReconciliationStatus",
      "Failed to fetch reconciliation status",
      error,
    );
    return {
      todayBalance: 0,
      yesterdayBalance: 0,
      totalWithdrawals: 0,
      totalDeposits: 0,
      variance: 0,
      targetDate,
    };
  }
}

/**
 * Approves a transaction by marking it as verified.
 */
export async function approveTransaction(id: string) {
  try {
    await query(
      "UPDATE transactions SET is_amount_verified = true WHERE id = $1",
      [id],
    );
    return { success: true };
  } catch (error) {
    logger.error("approveTransaction", "Failed to approve transaction", error);
    return { success: false, error: "Failed to approve transaction" };
  }
}

/**
 * Force approves a transaction by clearing all anomaly flags and marking it as verified.
 */
export async function forceApproveTransaction(id: string) {
  try {
    await query(
      `
      UPDATE transactions 
      SET is_amount_verified = true, 
          is_amount_mismatch = false, 
          is_duplicate = false 
      WHERE id = $1
    `,
      [id],
    );

    // Refresh the dashboard data
    revalidatePath("/dashboard/[projectId]", "page");

    return { success: true };
  } catch (error) {
    logger.error(
      "forceApproveTransaction",
      "Failed to force approve transaction",
      error,
    );
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
  transfer_date: string;
  transfer_time?: string;
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
      input.sender_name,
      input.sender_account,
      input.sender_bank,
      accounts,
    );

    // 3. Determine if there's an anomaly (amount mismatch or duplicate)
    // For simplicity, we just set the flags based on input here
    const isAmountMismatch = Math.abs(input.amount - input.ai_amount) > 0.01;

    // 4. Insert into transactions
    const sql = `
      INSERT INTO transactions (
        source_project_id, 
        target_project_id, 
        amount, 
        ai_amount,
        sender_name, 
        receiver_name, 
        sender_bank, 
        transfer_date, 
        transfer_time, 
        image_path,
        is_amount_mismatch,
        project_account_id, 
        matching_status, 
        matching_confidence,
        possible_matches,
        sender_acc_num
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
      input.transfer_date,
      input.transfer_time || null,
      input.image_path,
      isAmountMismatch,
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
      created_at: row.created_at?.toISOString() || "",
      transfer_date: row.transfer_date ? row.transfer_date.toString() : "",
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
  try {
    const sql = `
      UPDATE transactions
      SET project_account_id = $1,
          matching_status = 'MANUAL_MAPPED'
      WHERE id = $2
    `;
    await query(sql, [selectedAccountId, transactionId]);

    revalidatePath("/dashboard/[projectId]/reconciliation", "page");
    return { success: true };
  } catch (error) {
    logger.error(
      "confirmTransactionMapping",
      "Failed to confirm mapping",
      error,
    );
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

    // 3. Process each transaction
    let updateCount = 0;
    for (const txn of transactions) {
      const match = runSmartMatch(
        txn.sender_name,
        txn.sender_acc_num,
        txn.sender_bank,
        accounts,
      );

      const updateSql = `
        UPDATE transactions
        SET project_account_id = $1,
            matching_status = $2,
            matching_confidence = $3,
            possible_matches = $4
        WHERE id = $5
      `;
      await query(updateSql, [
        match.matchedAccountId,
        match.status,
        match.score,
        match.possibleMatches || null,
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
