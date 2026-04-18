'use server';

import { query } from '@/lib/db';
import { subDays, format } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

export interface AccountBreakdown {
  account: string;
  total: number;
}

export interface DashboardSummary {
  totalDeposits: number;
  totalWithdrawals: number;
  latestBalance: number;
  // Income details
  deposit: number;
  manualIn: number;
  bonus: number;
  fixedDeposit: number;
  // Expense details
  withdraw: number;
  manualOut: number;
  redeem: number;
  affiliate: number;
  cashback: number;
  // Account Breakdowns
  depositBreakdown: AccountBreakdown[];
  withdrawalBreakdown: AccountBreakdown[];
}

export interface TransactionRecord {
  id: string;
  project_id: string; // UI compatibility (maps to source_project_id/UUID)
  project_name?: string; // Dynamic project name from database
  source_project_id: string;
  target_project_id: string;
  amount: number;
  ai_amount: number;
  is_duplicate: boolean;
  is_amount_mismatch: boolean;
  sender_name: string;
  receiver_name: string;
  sender_bank?: string;
  receiver_bank?: string;
  transfer_date: string;
  transfer_time?: string;
  image_path?: string;
  is_time_anomaly: boolean;
  created_at: string;
}

/**
 * Normalizes date range for queries.
 */
function getDateRange(from?: string, to?: string) {
  const startDate = from || format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const endDate = to || format(new Date(), 'yyyy-MM-dd');
  return { startDate, endDate };
}

/**
 * Aggregates results by formatted account name and sorts by total DESC.
 */
function aggregateBreakdown(rows: any[]): AccountBreakdown[] {
  const map = new Map<string, number>();
  
  rows.forEach(row => {
    const rawAccount = row.account || 'Unknown';
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
  if (trimmed.includes('|')) {
    const [id, name] = trimmed.split('|').map(s => s.trim());
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
async function getProjectIdentifiers(projectName: string): Promise<{ id: string, name: string } | null> {
  if (projectName === 'all' || !projectName) return null;
  try {
    logger.debug('getProjectIdentifiers', `Resolving identifiers for projectName: ${projectName}`);
    const result = await query(
      'SELECT id, project_name FROM projects WHERE project_name ILIKE \'%\' || $1 || \'%\' AND status = \'ACTIVE\' LIMIT 1', 
      [projectName]
    );
    logger.debug('getProjectIdentifiers', 'Resolve result', result.rows[0]);
    if (!result.rows[0]) return null;
    return {
      id: result.rows[0].id,
      name: result.rows[0].project_name
    };
  } catch (error) {
    logger.error('getProjectIdentifiers', `Failed to resolve identifiers for project: ${projectName}`, error);
    return null;
  }
}

/**
 * Fetches all active projects for the switcher.
 */
export async function getActiveProjects(): Promise<{ id: string, project_name: string }[]> {
  try {
    const sql = 'SELECT id, project_name FROM projects WHERE status = \'ACTIVE\' ORDER BY project_name ASC';
    const result = await query(sql);
    return result.rows;
  } catch (error) {
    logger.error('getActiveProjects', 'Failed to fetch active projects', error);
    return [];
  }
}

/**
 * Fetches a single project's details by its Name (from URL).
 */
export async function getProjectByName(name: string): Promise<{ id: string, project_name: string } | null> {
  if (name === 'all') return { id: 'all', project_name: 'ทุกโปรเจกต์' };
  try {
    const result = await query(
      'SELECT id, project_name FROM projects WHERE project_name ILIKE \'%\' || $1 || \'%\' AND status = \'ACTIVE\' LIMIT 1',
      [name]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('getProjectByName', `Failed to fetch project by name: ${name}`, error);
    return null;
  }
}

/**
 * Fetches the dashboard summary metrics.
 * @param projectId - The project identifier or 'all'.
 * @param from - Start date (YYYY-MM-DD).
 * @param to - End date (YYYY-MM-DD).
 */
export async function getDashboardSummary(projectId: string, from?: string, to?: string): Promise<DashboardSummary> {
  try {
    const isAll = projectId === 'all';
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
        withdrawalBreakdown: []
      };
    }

    // Query for deposits and withdrawals in the given range
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(deposit), 0) as total_deposits,
        COALESCE(SUM(withdraw), 0) as total_withdrawals,
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

    const totalDepositsQuery = `
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM report_deposits 
      WHERE status = 'สำเร็จ' 
      AND trans_date::date BETWEEN $1 AND $2
    `;

    const totalWithdrawalsQuery = `
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM report_withdrawals 
      WHERE status = 'สำเร็จ' 
      AND trans_date::date BETWEEN $1 AND $2
    `;

    logger.debug('getDashboardSummary', `Resolved project for projectId: ${projectId}`, project);
    const projectName = project?.name || '';
    const summaryParams = [projectName, isAll, startDate, endDate];
    const breakdownParams = [startDate, endDate];

    const [summaryRes, balanceRes, depositsRes, withdrawalsRes, totalDepRes, totalWdRes] = await Promise.all([
      query(summaryQuery, summaryParams),
      query(balanceQuery, isAll ? [endDate] : [projectName, endDate]),
      query(depositsBreakdownQuery, breakdownParams),
      query(withdrawalsBreakdownQuery, breakdownParams),
      query(totalDepositsQuery, breakdownParams),
      query(totalWithdrawalsQuery, breakdownParams)
    ]);

    const trueTotalDeposits = Number(totalDepRes.rows[0]?.total || 0);
    const trueTotalWithdrawals = Number(totalWdRes.rows[0]?.total || 0);

    return {
      totalDeposits: trueTotalDeposits,
      totalWithdrawals: trueTotalWithdrawals,
      latestBalance: Number(balanceRes.rows[0]?.latest_balance || 0),
      deposit: trueTotalDeposits,
      manualIn: Number(summaryRes.rows[0].manual_in),
      bonus: Number(summaryRes.rows[0].bonus),
      fixedDeposit: Number(summaryRes.rows[0].fixed_deposit),
      withdraw: trueTotalWithdrawals,
      manualOut: Number(summaryRes.rows[0].manual_out),
      redeem: Number(summaryRes.rows[0].redeem),
      affiliate: Number(summaryRes.rows[0].affiliate),
      cashback: Number(summaryRes.rows[0].cashback),
      depositBreakdown: aggregateBreakdown(depositsRes.rows),
      withdrawalBreakdown: aggregateBreakdown(withdrawalsRes.rows),
    };
  } catch (error) {
    logger.error('getDashboardSummary', 'Failed to fetch dashboard summary', { projectId, from, to, error });

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
      withdrawalBreakdown: []
    };
  }
}

/**
 * Fetches pending anomalies (mismatched amounts or duplicates) with pagination.
 */
export async function getPendingAnomalies(
  projectId: string, 
  from?: string, 
  to?: string,
  page: number = 1,
  searchQuery?: string
): Promise<{ data: TransactionRecord[], totalPages: number, currentPage: number }> {
  try {
    const isAll = projectId === 'all';
    const { startDate, endDate } = getDateRange(from, to);
    
    const project = isAll ? null : await getProjectIdentifiers(projectId);
    if (!isAll && !project) return { data: [], totalPages: 0, currentPage: page };

    const LIMIT = 10;
    const OFFSET = (page - 1) * LIMIT;

    const sql = `
      SELECT t.id, t.source_project_id, t.target_project_id, t.amount, t.ai_amount, t.is_duplicate, t.is_amount_mismatch, t.is_time_anomaly,
             t.sender_name, t.receiver_name, t.sender_bank, t.receiver_bank, 
             t.transfer_date, t.transfer_time, t.image_path, t.created_at,
             p.project_name
      FROM transactions t
      LEFT JOIN projects p ON t.source_project_id = p.id
      WHERE (t.is_amount_mismatch = true OR t.is_duplicate = true OR t.is_time_anomaly = true)
      AND (t.is_amount_verified = false OR t.is_amount_verified IS NULL)
      AND (t.source_project_id = $1 OR t.target_project_id = $1 OR $2 = true)
      AND t.created_at::date BETWEEN $3 AND $4
      AND ($5::text IS NULL OR $5 = '' OR (
        t.sender_name ILIKE '%' || $5 || '%' OR 
        t.receiver_name ILIKE '%' || $5 || '%' OR
        t.id::text ILIKE '%' || $5 || '%'
      ))
      ORDER BY t.created_at DESC
      LIMIT $6 OFFSET $7
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM transactions t
      WHERE (t.is_amount_mismatch = true OR t.is_duplicate = true OR t.is_time_anomaly = true)
      AND (t.is_amount_verified = false OR t.is_amount_verified IS NULL)
      AND (t.source_project_id = $1 OR t.target_project_id = $1 OR $2 = true)
      AND t.created_at::date BETWEEN $3 AND $4
      AND ($5::text IS NULL OR $5 = '' OR (
        t.sender_name ILIKE '%' || $5 || '%' OR 
        t.receiver_name ILIKE '%' || $5 || '%' OR
        t.id::text ILIKE '%' || $5 || '%'
      ))
    `;

    logger.debug('getPendingAnomalies', `Fetching anomalies`, { projectId, uuid: project?.id, page, searchQuery });

    const projectIdParam = project?.id || null;
    const [result, countRes] = await Promise.all([
      query(sql, [projectIdParam, isAll, startDate, endDate, searchQuery, LIMIT, OFFSET]),
      query(countSql, [projectIdParam, isAll, startDate, endDate, searchQuery])
    ]);

    const totalItems = Number(countRes.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalItems / LIMIT);

    const data = result.rows.map(row => ({
      id: row.id,
      project_id: row.source_project_id,
      project_name: row.project_name,
      source_project_id: row.source_project_id,
      target_project_id: row.target_project_id,
      amount: Number(row.amount || 0),
      ai_amount: Number(row.ai_amount || 0),
      is_duplicate: Boolean(row.is_duplicate),
      is_amount_mismatch: Boolean(row.is_amount_mismatch),
      is_time_anomaly: Boolean(row.is_time_anomaly),
      sender_name: row.sender_name || '',
      receiver_name: row.receiver_name || '',
      sender_bank: row.sender_bank || undefined,
      receiver_bank: row.receiver_bank || undefined,
      transfer_date: row.transfer_date ? row.transfer_date.toString() : '',
      transfer_time: row.transfer_time || undefined,
      image_path: row.image_path || undefined,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    }));

    return { data, totalPages, currentPage: page };
  } catch (error) {
    logger.error('getPendingAnomalies', 'Failed to fetch pending anomalies', error);
    return { data: [], totalPages: 0, currentPage: page };
  }
}

/**
 * Fetches daily chart data for the selected range.
 */
export async function getDailyChartData(projectId: string, from?: string, to?: string) {
  try {
    const isAll = projectId === 'all';
    const { startDate, endDate } = getDateRange(from, to);
    
    const project = isAll ? null : await getProjectIdentifiers(projectId);
    if (!isAll && !project) return [];

    const sql = `
      SELECT 
        sd.report_date, 
        (SELECT COALESCE(SUM(amount), 0) FROM report_deposits rd WHERE rd.trans_date::date = sd.report_date AND rd.status = 'สำเร็จ') as deposits, 
        (SELECT COALESCE(SUM(amount), 0) FROM report_withdrawals rw WHERE rw.trans_date::date = sd.report_date AND rw.status = 'สำเร็จ') as withdrawals,
        ((SELECT COALESCE(SUM(amount), 0) FROM report_deposits rd WHERE rd.trans_date::date = sd.report_date AND rd.status = 'สำเร็จ') - (SELECT COALESCE(SUM(amount), 0) FROM report_withdrawals rw WHERE rw.trans_date::date = sd.report_date AND rw.status = 'สำเร็จ')) as net_diff
      FROM report_summary_daily sd
      WHERE (sd.project_id ILIKE '%' || $1 || '%' OR $2 = true)
      AND sd.report_date::date BETWEEN $3 AND $4
      GROUP BY sd.report_date
      ORDER BY sd.report_date ASC
    `;

    const projectName = project?.name || '';
    logger.debug('getDailyChartData', `Fetching chart data`, { projectId, projectName, startDate, endDate });
    const result = await query(sql, [projectName, isAll, startDate, endDate]);

    return result.rows.map(row => ({
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(row.report_date)),
      deposits: Number(row.deposits),
      withdrawals: Number(row.withdrawals),
      netDiff: Number(row.net_diff),
      date: typeof row.report_date === 'string' ? row.report_date : row.report_date.toISOString().split('T')[0],
    }));
  } catch (error) {
    logger.error('getDailyChartData', 'Failed to fetch daily chart data', error);
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
export async function getReconciliationStatus(projectId: string, targetDate: string): Promise<ReconciliationStatus> {
  try {
    const isAll = projectId === 'all';
    const project = isAll ? null : await getProjectIdentifiers(projectId);
    if (!isAll && !project) {
      return { todayBalance: 0, yesterdayBalance: 0, totalWithdrawals: 0, totalDeposits: 0, variance: 0, targetDate };
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
    `;

    // 4. Fetch deposits from report_summary_daily
    const depositsSql = `
      SELECT COALESCE(SUM(deposit), 0) as total 
      FROM report_summary_daily 
      WHERE (project_id ILIKE '%' || $1 || '%' OR $2 = true)
      AND report_date = $3
    `;

    const projectName = project?.name || '';
    const projectIdParam = project?.id || null;
    logger.debug('getReconciliationStatus', `Fetching reconciliation status`, { projectId, uuid: projectIdParam, projectName, targetDate });

    const [todayRes, yesterdayRes, withdrawalsRes, depositsRes] = await Promise.all([
      query(todayBalanceSql, [projectName, isAll, targetDate]),
      query(yesterdayBalanceSql, isAll ? [targetDate] : [projectName, targetDate]),
      query(withdrawalsSql, [projectIdParam, isAll, targetDate]),
      query(depositsSql, [projectName, isAll, targetDate])
    ]);

    const todayBalance = Number(todayRes.rows[0]?.total || 0);
    const yesterdayBalance = Number(yesterdayRes.rows[0]?.total || 0);
    const totalWithdrawals = Number(withdrawalsRes.rows[0]?.total || 0);
    const totalDeposits = Number(depositsRes.rows[0]?.total || 0);

    // Equation: Variance = ((Today - Yesterday) + Withdrawals) - Deposits
    const variance = ((todayBalance - yesterdayBalance) + totalWithdrawals) - totalDeposits;

    return {
      todayBalance,
      yesterdayBalance,
      totalWithdrawals,
      totalDeposits,
      variance,
      targetDate
    };
  } catch (error) {
    logger.error('getReconciliationStatus', 'Failed to fetch reconciliation status', error);
    return {
      todayBalance: 0,
      yesterdayBalance: 0,
      totalWithdrawals: 0,
      totalDeposits: 0,
      variance: 0,
      targetDate
    };
  }
}

/**
 * Approves a transaction by marking it as verified.
 */
export async function approveTransaction(id: string) {
  try {
    await query('UPDATE transactions SET is_amount_verified = true WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    logger.error('approveTransaction', 'Failed to approve transaction', error);
    return { success: false, error: 'Failed to approve transaction' };
  }
}

/**
 * Force approves a transaction by clearing all anomaly flags and marking it as verified.
 */
export async function forceApproveTransaction(id: string) {
  try {
    await query(`
      UPDATE transactions 
      SET is_amount_verified = true, 
          is_amount_mismatch = false, 
          is_duplicate = false 
      WHERE id = $1
    `, [id]);
    
    // Refresh the dashboard data
    revalidatePath('/dashboard/[projectId]', 'page');
    
    return { success: true };
  } catch (error) {
    logger.error('forceApproveTransaction', 'Failed to force approve transaction', error);
    return { success: false, error: 'Failed to force approve transaction' };
  }
}
