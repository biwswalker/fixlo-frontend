import { describe, it, expect } from "vitest";
import { rangeFor } from "../dateRange";

describe("rangeFor", () => {
  describe("day", () => {
    it("returns same date for from and to", () => {
      const date = new Date("2026-05-27T00:00:00.000Z");
      const { from, to } = rangeFor(date, "day");
      expect(from).toEqual(date);
      expect(to).toEqual(date);
    });
  });

  describe("week (ISO Mon–Sun)", () => {
    it("Wednesday anchor → Monday to Sunday", () => {
      const date = new Date("2026-05-27T00:00:00.000Z"); // Wednesday
      const { from, to } = rangeFor(date, "week");
      expect(from.toISOString().slice(0, 10)).toBe("2026-05-25"); // Monday
      expect(to.toISOString().slice(0, 10)).toBe("2026-05-31"); // Sunday
    });

    it("Monday anchor → same week", () => {
      const date = new Date("2026-05-25T00:00:00.000Z"); // Monday
      const { from, to } = rangeFor(date, "week");
      expect(from.toISOString().slice(0, 10)).toBe("2026-05-25");
      expect(to.toISOString().slice(0, 10)).toBe("2026-05-31");
    });

    it("Sunday anchor → same week", () => {
      const date = new Date("2026-05-31T00:00:00.000Z"); // Sunday
      const { from, to } = rangeFor(date, "week");
      expect(from.toISOString().slice(0, 10)).toBe("2026-05-25");
      expect(to.toISOString().slice(0, 10)).toBe("2026-05-31");
    });

    it("handles year boundary (2024-12-30 Mon → 2025-01-05 Sun)", () => {
      const date = new Date("2024-12-30T00:00:00.000Z");
      const { from, to } = rangeFor(date, "week");
      expect(from.toISOString().slice(0, 10)).toBe("2024-12-30");
      expect(to.toISOString().slice(0, 10)).toBe("2025-01-05");
    });

    it("handles month boundary (2025-03-31 Mon → 2025-04-06 Sun)", () => {
      const date = new Date("2025-03-31T00:00:00.000Z");
      const { from, to } = rangeFor(date, "week");
      expect(from.toISOString().slice(0, 10)).toBe("2025-03-31");
      expect(to.toISOString().slice(0, 10)).toBe("2025-04-06");
    });
  });

  describe("month", () => {
    it("returns first and last day of calendar month", () => {
      const date = new Date("2026-05-15T00:00:00.000Z");
      const { from, to } = rangeFor(date, "month");
      expect(from.toISOString().slice(0, 10)).toBe("2026-05-01");
      expect(to.toISOString().slice(0, 10)).toBe("2026-05-31");
    });

    it("handles Feb in non-leap year", () => {
      const date = new Date("2025-02-15T00:00:00.000Z");
      const { from, to } = rangeFor(date, "month");
      expect(from.toISOString().slice(0, 10)).toBe("2025-02-01");
      expect(to.toISOString().slice(0, 10)).toBe("2025-02-28");
    });

    it("handles leap year Feb", () => {
      const date = new Date("2024-02-29T00:00:00.000Z");
      const { from, to } = rangeFor(date, "month");
      expect(from.toISOString().slice(0, 10)).toBe("2024-02-01");
      expect(to.toISOString().slice(0, 10)).toBe("2024-02-29");
    });
  });

  describe("year", () => {
    it("returns Jan 1 to Dec 31", () => {
      const date = new Date("2026-05-15T00:00:00.000Z");
      const { from, to } = rangeFor(date, "year");
      expect(from.toISOString().slice(0, 10)).toBe("2026-01-01");
      expect(to.toISOString().slice(0, 10)).toBe("2026-12-31");
    });

    it("handles Dec 31 anchor", () => {
      const date = new Date("2025-12-31T00:00:00.000Z");
      const { from, to } = rangeFor(date, "year");
      expect(from.toISOString().slice(0, 10)).toBe("2025-01-01");
      expect(to.toISOString().slice(0, 10)).toBe("2025-12-31");
    });

    it("handles leap year", () => {
      const date = new Date("2024-02-29T00:00:00.000Z");
      const { from, to } = rangeFor(date, "year");
      expect(from.toISOString().slice(0, 10)).toBe("2024-01-01");
      expect(to.toISOString().slice(0, 10)).toBe("2024-12-31");
    });
  });
});
