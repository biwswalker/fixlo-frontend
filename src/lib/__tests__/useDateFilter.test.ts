import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveDateFromSources, formatDateParam, yesterdayBangkok } from "../useDateFilter";

// useDateFilter pure logic tests (no React hooks)

describe("yesterdayBangkok", () => {
  it("returns yesterday in YYYY-MM-DD format", () => {
    // Mock Date to 2026-05-28 at 12:00 UTC (Bangkok: 2026-05-28 19:00)
    const mockDate = new Date("2026-05-28T12:00:00.000Z");
    const result = yesterdayBangkok(mockDate);
    expect(result).toBe("2026-05-27");
  });

  it("handles midnight Bangkok crossing", () => {
    // 2026-05-28T17:00:00Z = 2026-05-29T00:00:00+07:00 (just became tomorrow in Bangkok)
    // yesterday Bangkok = 2026-05-28
    const mockDate = new Date("2026-05-28T17:00:00.000Z");
    const result = yesterdayBangkok(mockDate);
    expect(result).toBe("2026-05-28");
  });

  it("handles year boundary", () => {
    // 2026-01-01T12:00:00Z → Bangkok 2026-01-01 19:00 → yesterday = 2025-12-31
    const mockDate = new Date("2026-01-01T12:00:00.000Z");
    const result = yesterdayBangkok(mockDate);
    expect(result).toBe("2025-12-31");
  });
});

describe("formatDateParam", () => {
  it("returns YYYY-MM-DD from Date", () => {
    const d = new Date("2026-05-27T00:00:00.000Z");
    expect(formatDateParam(d)).toBe("2026-05-27");
  });
});

describe("resolveDateFromSources", () => {
  it("prefers URL over sessionStorage over default", () => {
    const result = resolveDateFromSources("2026-05-20", "2026-05-15", "2026-05-01");
    expect(result).toBe("2026-05-20");
  });

  it("falls back to sessionStorage when URL is absent", () => {
    const result = resolveDateFromSources(null, "2026-05-15", "2026-05-01");
    expect(result).toBe("2026-05-15");
  });

  it("falls back to default when both URL and sessionStorage are absent", () => {
    const result = resolveDateFromSources(null, null, "2026-05-01");
    expect(result).toBe("2026-05-01");
  });

  it("validates YYYY-MM-DD format — rejects garbage URL param", () => {
    const result = resolveDateFromSources("not-a-date", "2026-05-15", "2026-05-01");
    expect(result).toBe("2026-05-15");
  });

  it("validates YYYY-MM-DD format — rejects garbage sessionStorage value", () => {
    const result = resolveDateFromSources(null, "not-a-date", "2026-05-01");
    expect(result).toBe("2026-05-01");
  });
});
