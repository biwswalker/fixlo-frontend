export interface ApayStatsRow {
  deposit_amount: string | number;
  withdrawal_amount: string | number;
  fee_amount: string | number | null;
  scraped_at: string | null;
  source: "scraper" | "discord";
}

export interface ParsedApayStats {
  depositAmount: number;
  withdrawalAmount: number;
  feeAmount: number | null;
  scrapedAt: string | null;
  source: "scraper" | "discord";
}

export function parseApayStatsRow(row: ApayStatsRow): ParsedApayStats {
  return {
    depositAmount: parseFloat(String(row.deposit_amount)),
    withdrawalAmount: parseFloat(String(row.withdrawal_amount)),
    feeAmount: row.fee_amount != null ? parseFloat(String(row.fee_amount)) : null,
    scrapedAt: row.scraped_at,
    source: row.source,
  };
}

export function buildApayStatsQuery(): string {
  return `SELECT rad.deposit_amount, rad.withdrawal_amount, rad.fee_amount, rad.scraped_at, rad.source
       FROM report_apay_daily rad
       JOIN project_accounts pa ON pa.id = rad.project_account_id
       WHERE rad.date = $1
         AND LOWER(pa.bank_code) = 'apay'
         AND pa.project_id = $2
         AND pa.deleted_at IS NULL
       ORDER BY CASE WHEN rad.source = 'scraper' THEN 0 ELSE 1 END
       LIMIT 1`;
}

// ---------------------------------------------------------------------------
// Apay row merge into reconciliation account-breakdown table (ADR 0016)
// ---------------------------------------------------------------------------

export interface ApayAccountReportRow {
  account_id: string;
  account_name: string;
  bank_code: string;
  deposit_amount: string | number | null;
  withdrawal_amount: string | number | null;
  source: "scraper" | "discord" | null;
}

export interface ParsedApayAccountReport {
  accountId: string;
  accountName: string;
  bankCode: string;
  /** report_apay_daily.deposit_amount → ยอดรับ of the Apay row; null = no report row that day */
  gatewayInflow: number | null;
  /** report_apay_daily.withdrawal_amount → effectiveOutflow of the Apay row; null = no report row */
  gatewayOutflow: number | null;
  /** null when no report row exists for the day */
  reportSource: "scraper" | "discord" | null;
}

export function parseApayAccountReportRow(row: ApayAccountReportRow): ParsedApayAccountReport {
  return {
    accountId: String(row.account_id),
    accountName: row.account_name,
    bankCode: row.bank_code,
    gatewayInflow: row.deposit_amount != null ? parseFloat(String(row.deposit_amount)) : null,
    gatewayOutflow: row.withdrawal_amount != null ? parseFloat(String(row.withdrawal_amount)) : null,
    reportSource: row.source ?? null,
  };
}

/**
 * Always returns the Apay project_account for the project (LEFT JOIN so the row
 * survives even when no report_apay_daily exists that day → render "—/ไม่มีรายงาน").
 * scraper takes priority over discord when both exist (ADR 0009 §3).
 */
export function buildApayAccountReportQuery(): string {
  return `SELECT pa.id::text AS account_id, pa.account_name, pa.bank_code,
            rad.deposit_amount, rad.withdrawal_amount, rad.source
       FROM project_accounts pa
       LEFT JOIN report_apay_daily rad
         ON rad.project_account_id = pa.id AND rad.date = $1
       WHERE LOWER(pa.bank_code) = 'apay'
         AND pa.project_id = $2
         AND pa.deleted_at IS NULL
       ORDER BY CASE WHEN rad.source = 'scraper' THEN 0 WHEN rad.source = 'discord' THEN 1 ELSE 2 END
       LIMIT 1`;
}
