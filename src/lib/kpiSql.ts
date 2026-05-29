/**
 * Canonical deposit/withdraw KPI SQL builders.
 *
 * All helpers accept parameter-placeholder positions so callers can compose
 * them into larger queries without placeholder collisions.
 *
 * Status filter ('สำเร็จ') is hard-coded — it is part of the canonical
 * KPI definition (ADR 0004) and must not be caller-configurable.
 *
 * Pass projectParam to filter by integer project_id FK (post-migration 041).
 * Omit for backwards-compatible aggregate (all projects).
 */

function projectFilter(projectParam?: number): string {
  return projectParam != null ? `AND project_id = $${projectParam}` : "";
}

export function depositTotalSql(startParam: number, endParam: number, projectParam?: number): string {
  const pf = projectFilter(projectParam);
  return `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM (
      SELECT amount FROM report_deposits
        WHERE status = 'สำเร็จ'
          AND trans_date::date BETWEEN $${startParam} AND $${endParam}
          ${pf}
      UNION ALL
      SELECT amount FROM report_manual_credit_in
        WHERE trans_date::date BETWEEN $${startParam} AND $${endParam}
          ${pf}
    ) _deposit_combined
  `;
}

export function withdrawTotalSql(startParam: number, endParam: number, projectParam?: number): string {
  const pf = projectFilter(projectParam);
  return `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM report_withdrawals
    WHERE status = 'สำเร็จ'
      AND trans_date::date BETWEEN $${startParam} AND $${endParam}
      ${pf}
  `;
}

export function depositPerDaySql(startParam: number, endParam: number, projectParam?: number): string {
  const pf = projectFilter(projectParam);
  return `
    SELECT trans_date::date::text AS day_date, COALESCE(SUM(amount), 0) AS total
    FROM (
      SELECT trans_date, amount FROM report_deposits
        WHERE status = 'สำเร็จ'
          AND trans_date::date BETWEEN $${startParam} AND $${endParam}
          ${pf}
      UNION ALL
      SELECT trans_date, amount FROM report_manual_credit_in
        WHERE trans_date::date BETWEEN $${startParam} AND $${endParam}
          ${pf}
    ) _deposit_daily
    GROUP BY trans_date::date
    ORDER BY trans_date::date ASC
  `;
}

export function withdrawPerDaySql(startParam: number, endParam: number, projectParam?: number): string {
  const pf = projectFilter(projectParam);
  return `
    SELECT trans_date::date::text AS day_date, COALESCE(SUM(amount), 0) AS total
    FROM report_withdrawals
    WHERE status = 'สำเร็จ'
      AND trans_date::date BETWEEN $${startParam} AND $${endParam}
      ${pf}
    GROUP BY trans_date::date
    ORDER BY trans_date::date ASC
  `;
}
