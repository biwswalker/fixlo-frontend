import { describe, it, expect } from "vitest";
import {
  parseApayStatsRow,
  buildApayStatsQuery,
  parseApayAccountReportRow,
  buildApayAccountReportQuery,
} from "../apayStats";

describe("parseApayStatsRow", () => {
  it("scraper row → source: 'scraper'", () => {
    const row = {
      deposit_amount: "12500.00",
      withdrawal_amount: "3000.00",
      fee_amount: "25.00",
      scraped_at: "2026-05-25T08:00:00Z",
      source: "scraper" as const,
    };
    const result = parseApayStatsRow(row);
    expect(result.source).toBe("scraper");
    expect(result.depositAmount).toBe(12500);
    expect(result.feeAmount).toBe(25);
  });

  it("discord row → source: 'discord'", () => {
    const row = {
      deposit_amount: "8000.00",
      withdrawal_amount: "1500.00",
      fee_amount: null,
      scraped_at: null,
      source: "discord" as const,
    };
    const result = parseApayStatsRow(row);
    expect(result.source).toBe("discord");
    expect(result.feeAmount).toBeNull();
  });

  it("null fee_amount does not crash", () => {
    const row = {
      deposit_amount: "5000.00",
      withdrawal_amount: "0.00",
      fee_amount: null,
      scraped_at: null,
      source: "discord" as const,
    };
    expect(() => parseApayStatsRow(row)).not.toThrow();
    expect(parseApayStatsRow(row).feeAmount).toBeNull();
  });
});

describe("buildApayStatsQuery", () => {
  it("query prefers scraper over discord via ORDER BY", () => {
    const sql = buildApayStatsQuery();
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("scraper");
  });

  it("query selects source column", () => {
    expect(buildApayStatsQuery()).toContain("source");
  });
});

describe("parseApayAccountReportRow", () => {
  it("parses deposit/withdrawal into gatewayInflow/gatewayOutflow", () => {
    const result = parseApayAccountReportRow({
      account_id: "abc-123",
      account_name: "ACCTEAM",
      bank_code: "Apay",
      deposit_amount: "45000.00",
      withdrawal_amount: "12000.00",
      source: "scraper",
    });
    expect(result).toEqual({
      accountId: "abc-123",
      accountName: "ACCTEAM",
      bankCode: "Apay",
      gatewayInflow: 45000,
      gatewayOutflow: 12000,
      reportSource: "scraper",
    });
  });

  it("no report row (LEFT JOIN nulls) → gateway values + source null", () => {
    const result = parseApayAccountReportRow({
      account_id: "abc-123",
      account_name: "ACCTEAM",
      bank_code: "Apay",
      deposit_amount: null,
      withdrawal_amount: null,
      source: null,
    });
    expect(result.gatewayInflow).toBeNull();
    expect(result.gatewayOutflow).toBeNull();
    expect(result.reportSource).toBeNull();
  });
});

describe("buildApayAccountReportQuery", () => {
  it("LEFT JOINs report_apay_daily so the account survives with no report row", () => {
    const sql = buildApayAccountReportQuery();
    expect(sql).toContain("LEFT JOIN report_apay_daily");
    expect(sql).toContain("project_accounts");
  });

  it("prefers scraper over discord", () => {
    const sql = buildApayAccountReportQuery();
    const scraperIdx = sql.indexOf("'scraper'");
    const discordIdx = sql.indexOf("'discord'");
    expect(scraperIdx).toBeGreaterThan(-1);
    expect(scraperIdx).toBeLessThan(discordIdx);
  });
});
