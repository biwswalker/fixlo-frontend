import { describe, it, expect } from "vitest";
import {
  depositTotalSql,
  withdrawTotalSql,
  depositPerDaySql,
  withdrawPerDaySql,
} from "../kpiSql";

describe("depositTotalSql", () => {
  it("references report_deposits and report_manual_credit_in only", () => {
    const sql = depositTotalSql(1, 2);
    expect(sql).toContain("report_deposits");
    expect(sql).toContain("report_manual_credit_in");
    expect(sql).not.toContain("report_manual_bonus_in");
    expect(sql).not.toContain("report_summary_daily");
    expect(sql).not.toContain("report_withdrawals");
    expect(sql).not.toContain("report_manual_credit_out");
  });

  it("applies status filter only on report_deposits block", () => {
    const sql = depositTotalSql(1, 2);
    expect(sql).toContain("สำเร็จ");
    // status filter must appear in context of report_deposits, not manual_credit_in
    const depositsBlock = sql.slice(
      sql.indexOf("report_deposits"),
      sql.indexOf("report_manual_credit_in"),
    );
    expect(depositsBlock).toContain("สำเร็จ");
    const manualBlock = sql.slice(sql.indexOf("report_manual_credit_in"));
    expect(manualBlock).not.toContain("สำเร็จ");
  });

  it("uses the provided parameter placeholders", () => {
    const sql = depositTotalSql(1, 2);
    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
  });

  it("uses caller-provided offset positions", () => {
    const sql = depositTotalSql(3, 4);
    expect(sql).toContain("$3");
    expect(sql).toContain("$4");
    expect(sql).not.toContain("$1");
    expect(sql).not.toContain("$2");
  });

  it("returns a scalar total (COALESCE SUM)", () => {
    const sql = depositTotalSql(1, 2);
    expect(sql.toLowerCase()).toContain("coalesce");
    expect(sql.toLowerCase()).toContain("sum");
  });
});

describe("withdrawTotalSql", () => {
  it("references report_withdrawals only — excludes report_manual_credit_out (game-side adjustment, not cash)", () => {
    const sql = withdrawTotalSql(1, 2);
    expect(sql).toContain("report_withdrawals");
    expect(sql).not.toContain("report_manual_credit_out");
    expect(sql).not.toContain("report_deposits");
    expect(sql).not.toContain("report_manual_credit_in");
    expect(sql).not.toContain("report_manual_bonus_in");
    expect(sql).not.toContain("report_summary_daily");
  });

  it("applies status filter on report_withdrawals", () => {
    const sql = withdrawTotalSql(1, 2);
    expect(sql).toContain("สำเร็จ");
  });

  it("uses caller-provided parameter placeholders", () => {
    const sql = withdrawTotalSql(1, 2);
    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
  });

  it("uses caller-provided offset positions", () => {
    const sql = withdrawTotalSql(3, 4);
    expect(sql).toContain("$3");
    expect(sql).toContain("$4");
    expect(sql).not.toContain("$1");
  });

  it("returns a scalar total (COALESCE SUM)", () => {
    const sql = withdrawTotalSql(1, 2);
    expect(sql.toLowerCase()).toContain("coalesce");
    expect(sql.toLowerCase()).toContain("sum");
  });
});

describe("depositPerDaySql", () => {
  it("references report_deposits and report_manual_credit_in only", () => {
    const sql = depositPerDaySql(1, 2);
    expect(sql).toContain("report_deposits");
    expect(sql).toContain("report_manual_credit_in");
    expect(sql).not.toContain("report_manual_bonus_in");
    expect(sql).not.toContain("report_summary_daily");
    expect(sql).not.toContain("report_withdrawals");
  });

  it("applies status filter only on report_deposits block", () => {
    const sql = depositPerDaySql(1, 2);
    const depositsBlock = sql.slice(
      sql.indexOf("report_deposits"),
      sql.indexOf("report_manual_credit_in"),
    );
    expect(depositsBlock).toContain("สำเร็จ");
    const manualBlock = sql.slice(sql.indexOf("report_manual_credit_in"));
    expect(manualBlock).not.toContain("สำเร็จ");
  });

  it("groups by day and orders ascending", () => {
    const sql = depositPerDaySql(1, 2);
    expect(sql.toLowerCase()).toContain("group by");
    expect(sql.toLowerCase()).toContain("order by");
    expect(sql.toLowerCase()).toContain("asc");
  });

  it("returns day_date and total columns", () => {
    const sql = depositPerDaySql(1, 2);
    expect(sql).toContain("day_date");
    expect(sql.toLowerCase()).toContain("total");
  });

  it("uses caller-provided offset positions", () => {
    const sql = depositPerDaySql(3, 4);
    expect(sql).toContain("$3");
    expect(sql).toContain("$4");
    expect(sql).not.toContain("$1");
  });
});

describe("depositTotalSql — project filter", () => {
  it("includes project_id filter when projectParam provided", () => {
    const sql = depositTotalSql(1, 2, 3);
    expect(sql).toContain("project_id = $3");
  });

  it("omits project_id filter when projectParam not provided", () => {
    const sql = depositTotalSql(1, 2);
    expect(sql).not.toContain("project_id");
  });
});

describe("withdrawTotalSql — project filter", () => {
  it("includes project_id filter when projectParam provided", () => {
    const sql = withdrawTotalSql(1, 2, 3);
    expect(sql).toContain("project_id = $3");
  });

  it("omits project_id filter when projectParam not provided", () => {
    const sql = withdrawTotalSql(1, 2);
    expect(sql).not.toContain("project_id");
  });
});

describe("withdrawPerDaySql", () => {
  it("references report_withdrawals only — excludes report_manual_credit_out (game-side adjustment, not cash)", () => {
    const sql = withdrawPerDaySql(1, 2);
    expect(sql).toContain("report_withdrawals");
    expect(sql).not.toContain("report_manual_credit_out");
    expect(sql).not.toContain("report_deposits");
    expect(sql).not.toContain("report_manual_bonus_in");
    expect(sql).not.toContain("report_summary_daily");
  });

  it("applies status filter on report_withdrawals", () => {
    const sql = withdrawPerDaySql(1, 2);
    expect(sql).toContain("สำเร็จ");
  });

  it("groups by day and orders ascending", () => {
    const sql = withdrawPerDaySql(1, 2);
    expect(sql.toLowerCase()).toContain("group by");
    expect(sql.toLowerCase()).toContain("order by");
    expect(sql.toLowerCase()).toContain("asc");
  });

  it("returns day_date and total columns", () => {
    const sql = withdrawPerDaySql(1, 2);
    expect(sql).toContain("day_date");
    expect(sql.toLowerCase()).toContain("total");
  });

  it("uses caller-provided offset positions", () => {
    const sql = withdrawPerDaySql(3, 4);
    expect(sql).toContain("$3");
    expect(sql).toContain("$4");
    expect(sql).not.toContain("$1");
  });
});
