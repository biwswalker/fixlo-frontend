// CRM agent KPI SQL. See docs/crm/adr/0003-service-desk-reframe.md.
// Per project × business-day × agent: sessions handled/answered, avg FRT, SLA
// pass count and %. Credited to the first responder. The materialized view
// crm_mv_agent_kpi_daily (migration 053) is defined from AGENT_KPI_AGGREGATE_SQL;
// reads go through the view for speed, aggregation lives here so it is testable.

// The work_date bucket is the FRT-start instant converted to the Bangkok business
// day, matching the operational-hours model.
export const AGENT_KPI_AGGREGATE_SQL = `
  SELECT s.project_id,
         (s.frt_start_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date AS work_date,
         a.fixlo_user_id,
         COUNT(*) AS sessions_handled,
         COUNT(*) FILTER (WHERE s.frt_seconds IS NOT NULL) AS sessions_answered,
         ROUND(AVG(s.frt_seconds)::numeric, 2) AS avg_frt_seconds,
         COUNT(*) FILTER (WHERE s.sla_passed) AS sla_passed_count,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE s.sla_passed)
           / NULLIF(COUNT(*) FILTER (WHERE s.frt_seconds IS NOT NULL), 0), 2
         ) AS sla_pass_pct
  FROM crm_sessions s
  JOIN crm_agent_profile a ON a.id = s.first_responder_id
  GROUP BY s.project_id, work_date, a.fixlo_user_id
`;

/**
 * Read the per-agent KPI rows for one project + business day from the
 * materialized view. `projectParam`/`dateParam` are placeholder positions.
 */
export function selectAgentKpiSql(projectParam: number, dateParam: number): string {
  return `
    SELECT project_id, work_date, fixlo_user_id,
           sessions_handled, sessions_answered, avg_frt_seconds,
           sla_passed_count, sla_pass_pct
    FROM crm_mv_agent_kpi_daily
    WHERE project_id = $${projectParam}
      AND work_date = $${dateParam}
    ORDER BY avg_frt_seconds ASC NULLS LAST
  `;
}
