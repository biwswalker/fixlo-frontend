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
