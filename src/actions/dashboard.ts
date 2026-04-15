'use server';

import { query } from '@/lib/db';
import { subDays, format } from 'date-fns';
import { revalidatePath } from 'next/cache';

export interface DashboardSummary {
  totalDeposits: number;
  totalWithdrawals: number;
  latestBalance: number;
}

export interface TransactionRecord {
  id: string;
  project_id: string;
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
 * Resolves a project name (from the URL) to its UUID.
 */
async function getProjectUuid(projectName: string): Promise<string | null> {
  if (projectName === 'all' || !projectName) return null;
  try {
    const result = await query('SELECT id FROM projects WHERE project_name = $1 LIMIT 1', [projectName]);
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error(`Error resolving UUID for project ${projectName}:`, error);
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
    
    // Resolve UUID if needed
    const projectUuid = isAll ? null : await getProjectUuid(projectId);
    if (!isAll && !projectUuid) {
      return { totalDeposits: 0, totalWithdrawals: 0, latestBalance: 0 };
    }

    // Query for deposits and withdrawals in the given range
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(deposit), 0) as total_deposits,
        COALESCE(SUM(withdraw), 0) as total_withdrawals
      FROM report_summary_daily
      WHERE (project_id = $1 OR $2 = true)
      AND report_date BETWEEN $3 AND $4
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
        WHERE project_id = $1 
        AND report_date <= $2
        ORDER BY report_date DESC 
        LIMIT 1
      `;

    const [summaryRes, balanceRes] = await Promise.all([
      query(summaryQuery, [projectUuid, isAll, startDate, endDate]),
      query(balanceQuery, isAll ? [endDate] : [projectUuid, endDate])
    ]);

    return {
      totalDeposits: Number(summaryRes.rows[0].total_deposits),
      totalWithdrawals: Number(summaryRes.rows[0].total_withdrawals),
      latestBalance: Number(balanceRes.rows[0]?.latest_balance || 0),
    };
  } catch (error) {
    console.error('Error in getDashboardSummary:', error);
    return {
      totalDeposits: 0,
      totalWithdrawals: 0,
      latestBalance: 0,
    };
  }
}

/**
 * Fetches pending anomalies (mismatched amounts or duplicates).
 */
export async function getPendingAnomalies(projectId: string, from?: string, to?: string): Promise<TransactionRecord[]> {
  try {
    const isAll = projectId === 'all';
    const { startDate, endDate } = getDateRange(from, to);
    
    const projectUuid = isAll ? null : await getProjectUuid(projectId);
    if (!isAll && !projectUuid) return [];

    const sql = `
      SELECT id, project_id, amount, ai_amount, is_duplicate, is_amount_mismatch, 
             sender_name, receiver_name, sender_bank, receiver_bank, 
             transfer_date, transfer_time, image_path, created_at
      FROM transactions
      WHERE (is_amount_mismatch = true OR is_duplicate = true)
      AND (is_amount_verified = false OR is_amount_verified IS NULL)
      AND (project_id = $1 OR $2 = true)
      AND created_at::date BETWEEN $3 AND $4
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const result = await query(sql, [projectUuid, isAll, startDate, endDate]);

    return result.rows.map(row => ({
      id: row.id,
      project_id: row.project_id,
      amount: Number(row.amount || 0),
      ai_amount: Number(row.ai_amount || 0),
      is_duplicate: Boolean(row.is_duplicate),
      is_amount_mismatch: Boolean(row.is_amount_mismatch),
      sender_name: row.sender_name || '',
      receiver_name: row.receiver_name || '',
      sender_bank: row.sender_bank || undefined,
      receiver_bank: row.receiver_bank || undefined,
      transfer_date: row.transfer_date ? row.transfer_date.toString() : '',
      transfer_time: row.transfer_time || undefined,
      image_path: row.image_path || undefined,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    }));
  } catch (error) {
    console.error('Error in getPendingAnomalies:', error);
    return [];
  }
}

/**
 * Fetches daily chart data for the selected range.
 */
export async function getDailyChartData(projectId: string, from?: string, to?: string) {
  try {
    const isAll = projectId === 'all';
    const { startDate, endDate } = getDateRange(from, to);
    
    const projectUuid = isAll ? null : await getProjectUuid(projectId);
    if (!isAll && !projectUuid) return [];

    const sql = `
      SELECT 
        report_date, 
        COALESCE(SUM(deposit), 0) as deposits, 
        COALESCE(SUM(withdraw), 0) as withdrawals,
        COALESCE(SUM(balance), 0) as balance
      FROM report_summary_daily
      WHERE (project_id = $1 OR $2 = true)
      AND report_date BETWEEN $3 AND $4
      GROUP BY report_date
      ORDER BY report_date ASC
    `;

    const result = await query(sql, [projectUuid, isAll, startDate, endDate]);

    return result.rows.map(row => ({
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(row.report_date)),
      deposits: Number(row.deposits),
      withdrawals: Number(row.withdrawals),
      balance: Number(row.balance),
      date: typeof row.report_date === 'string' ? row.report_date : row.report_date.toISOString().split('T')[0],
    }));
  } catch (error) {
    console.error('Error in getDailyChartData:', error);
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
    const projectUuid = isAll ? null : await getProjectUuid(projectId);
    if (!isAll && !projectUuid) {
      return { todayBalance: 0, yesterdayBalance: 0, totalWithdrawals: 0, totalDeposits: 0, variance: 0, targetDate };
    }

    // 1. Fetch Today's Balance
    const todayBalanceSql = `
      SELECT COALESCE(SUM(db.balance_amount), 0) as total 
      FROM daily_balances db
      JOIN projects p ON db.project_name = p.project_name
      WHERE (p.id = $1 OR $2 = true)
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
        WHERE p.id = $1 AND db.date < $2
        ORDER BY db.date DESC LIMIT 1
      `;

    // 3. Fetch withdrawals from transactions table
    const withdrawalsSql = `
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE (project_id = $1 OR $2 = true)
      AND transfer_date = $3
    `;

    // 4. Fetch deposits from report_summary_daily
    const depositsSql = `
      SELECT COALESCE(SUM(deposit), 0) as total 
      FROM report_summary_daily 
      WHERE (project_id = $1 OR $2 = true)
      AND report_date = $3
    `;

    const [todayRes, yesterdayRes, withdrawalsRes, depositsRes] = await Promise.all([
      query(todayBalanceSql, [projectUuid, isAll, targetDate]),
      query(yesterdayBalanceSql, isAll ? [targetDate] : [projectUuid, targetDate]),
      query(withdrawalsSql, [projectUuid, isAll, targetDate]),
      query(depositsSql, [projectUuid, isAll, targetDate])
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
    console.error('Error in getReconciliationStatus:', error);
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
    console.error('Error in approveTransaction:', error);
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
    console.error('Error in forceApproveTransaction:', error);
    return { success: false, error: 'Failed to force approve transaction' };
  }
}
