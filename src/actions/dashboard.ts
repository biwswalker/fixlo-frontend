'use server';

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface ReportSummaryDaily {
  project_id: string;
  report_date: Date;
  deposit: number;
  withdraw: number;
  balance: number;
}

export interface Transaction {
  id: string;
  project_id: string;
  amount: number;
  ai_amount: number;
  is_duplicate: boolean;
  is_amount_mismatch: boolean;
  type?: string; 
  created_at: Date;
}

export async function getDailySummary(projectId: string) {
  try {
    let query = 'SELECT * FROM report_summary_daily';
    const values: string[] = [];

    // The database table report_summary_daily does not have a project_id column.
    // Filtering by project_id is omitted here to prevent a crash.
    query += ' ORDER BY report_date DESC';

    const result = await pool.query(query, values);
    
    return result.rows.map(row => ({
      ...row,
      report_date: row.report_date?.toISOString() || new Date().toISOString(),
      deposit: Number(row.deposit || 0),
      withdraw: Number(row.withdraw || 0),
      balance: Number(row.balance || 0),
    }));
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    return [];
  }
}

export async function getPendingAnomalies(projectId: string) {
  try {
    let query = `
      SELECT * FROM transactions
      WHERE (is_amount_mismatch = true OR is_duplicate = true)
    `;
    const values: string[] = [];

    if (projectId !== 'all') {
      query += ' AND source_project_id = $1';
      values.push(projectId);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await pool.query(query, values);
    
    return result.rows.map(row => ({
      ...row,
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      amount: Number(row.amount || 0),
      ai_amount: Number(row.ai_amount || 0),
    }));
  } catch (error) {
    console.error('Error fetching pending anomalies:', error);
    return [];
  }
}
