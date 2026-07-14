import { describe, it, expect } from "vitest";
import { AGENT_KPI_AGGREGATE_SQL, selectAgentKpiSql } from "../crmKpi";

describe("AGENT_KPI_AGGREGATE_SQL", () => {
  it("aggregates crm_sessions credited to the first responder", () => {
    expect(AGENT_KPI_AGGREGATE_SQL).toContain("FROM crm_sessions s");
    expect(AGENT_KPI_AGGREGATE_SQL).toContain("a.id = s.first_responder_id");
  });

  it("buckets by the Bangkok business day", () => {
    expect(AGENT_KPI_AGGREGATE_SQL).toContain(
      "AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date AS work_date",
    );
  });

  it("aggregates FRT and SLA", () => {
    expect(AGENT_KPI_AGGREGATE_SQL).toContain("AVG(s.frt_seconds)");
    expect(AGENT_KPI_AGGREGATE_SQL).toContain("FILTER (WHERE s.sla_passed)");
    expect(AGENT_KPI_AGGREGATE_SQL).toContain("sla_pass_pct");
    // guard against divide-by-zero
    expect(AGENT_KPI_AGGREGATE_SQL).toContain("NULLIF(");
  });
});

describe("selectAgentKpiSql", () => {
  it("reads the materialized view with project + date placeholders", () => {
    const sql = selectAgentKpiSql(1, 2);
    expect(sql).toContain("FROM crm_mv_agent_kpi_daily");
    expect(sql).toContain("project_id = $1");
    expect(sql).toContain("work_date = $2");
  });

  it("orders by fastest average FRT", () => {
    expect(selectAgentKpiSql(1, 2)).toContain("ORDER BY avg_frt_seconds ASC");
  });
});
