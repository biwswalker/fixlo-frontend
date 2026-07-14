-- migration 053: CRM agent KPI read model (issue #165)
-- Per project × business-day × agent FRT/SLA. Body mirrors
-- src/lib/crmKpi.ts AGENT_KPI_AGGREGATE_SQL. Refresh via cron:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY crm_mv_agent_kpi_daily;
-- (CONCURRENTLY needs the unique index below.) See ADR 0003.

CREATE MATERIALIZED VIEW IF NOT EXISTS crm_mv_agent_kpi_daily AS
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
  GROUP BY s.project_id, work_date, a.fixlo_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_mv_agent_kpi
  ON crm_mv_agent_kpi_daily(project_id, work_date, fixlo_user_id);
