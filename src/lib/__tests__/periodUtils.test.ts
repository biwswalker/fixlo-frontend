import { describe, it, expect } from "vitest";
import { resolvePeriodToDateRange } from "../periodUtils";

describe("resolvePeriodToDateRange", () => {
  describe("day", () => {
    it("returns same date for from and to", () => {
      const result = resolvePeriodToDateRange("day", "2025-05-07");
      expect(result).toEqual({ from: "2025-05-07", to: "2025-05-07" });
    });

    it("handles end of month", () => {
      const result = resolvePeriodToDateRange("day", "2025-01-31");
      expect(result).toEqual({ from: "2025-01-31", to: "2025-01-31" });
    });

    it("handles Dec 31", () => {
      const result = resolvePeriodToDateRange("day", "2025-12-31");
      expect(result).toEqual({ from: "2025-12-31", to: "2025-12-31" });
    });
  });

  describe("week", () => {
    it("resolves ISO week containing date", () => {
      // 2025-05-07 is Wednesday, ISO week Mon=2025-05-05 to Sun=2025-05-11
      const result = resolvePeriodToDateRange("week", "2025-05-07");
      expect(result).toEqual({ from: "2025-05-05", to: "2025-05-11" });
    });

    it("resolves week spanning month boundary", () => {
      // 2025-03-31 (Monday) — week is Mon 2025-03-31 to Sun 2025-04-06
      const result = resolvePeriodToDateRange("week", "2025-03-31");
      expect(result).toEqual({ from: "2025-03-31", to: "2025-04-06" });
    });

    it("resolves week at year boundary", () => {
      // 2024-12-30 (Monday) — week is Mon 2024-12-30 to Sun 2026-01-05
      const result = resolvePeriodToDateRange("week", "2024-12-30");
      expect(result).toEqual({ from: "2024-12-30", to: "2025-01-05" });
    });
  });

  describe("month", () => {
    it("resolves full month range", () => {
      const result = resolvePeriodToDateRange("month", "2025-05-15");
      expect(result).toEqual({ from: "2025-05-01", to: "2025-05-31" });
    });

    it("handles Feb in non-leap year", () => {
      const result = resolvePeriodToDateRange("month", "2025-02-15");
      expect(result).toEqual({ from: "2025-02-01", to: "2025-02-28" });
    });

    it("handles leap year Feb 29", () => {
      const result = resolvePeriodToDateRange("month", "2024-02-29");
      expect(result).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    });

    it("handles month with 30 days", () => {
      const result = resolvePeriodToDateRange("month", "2025-04-15");
      expect(result).toEqual({ from: "2025-04-01", to: "2025-04-30" });
    });
  });

  describe("year", () => {
    it("resolves full year range", () => {
      const result = resolvePeriodToDateRange("year", "2025-05-07");
      expect(result).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    });

    it("handles Dec 31 anchor", () => {
      const result = resolvePeriodToDateRange("year", "2025-12-31");
      expect(result).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    });

    it("handles leap year", () => {
      const result = resolvePeriodToDateRange("year", "2024-02-29");
      expect(result).toEqual({ from: "2024-01-01", to: "2024-12-31" });
    });
  });
});
