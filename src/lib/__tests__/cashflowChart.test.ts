import { describe, it, expect } from "vitest";
import { mergeDailyChartRows } from "../cashflowChart";

describe("mergeDailyChartRows", () => {
  it("merges matching dates correctly", () => {
    const deposits = [{ day_date: "2025-05-07", total: "1000" }];
    const withdrawals = [{ day_date: "2025-05-07", total: "400" }];
    const result = mergeDailyChartRows(deposits, withdrawals);
    expect(result).toHaveLength(1);
    expect(result[0].deposits).toBe(1000);
    expect(result[0].withdrawals).toBe(400);
    expect(result[0].netDiff).toBe(600);
  });

  it("includes dates present only in deposits with zero withdrawals", () => {
    const deposits = [{ day_date: "2025-05-07", total: "500" }];
    const withdrawals: never[] = [];
    const result = mergeDailyChartRows(deposits, withdrawals);
    expect(result[0].withdrawals).toBe(0);
    expect(result[0].netDiff).toBe(500);
  });

  it("includes dates present only in withdrawals with zero deposits", () => {
    const deposits: never[] = [];
    const withdrawals = [{ day_date: "2025-05-07", total: "300" }];
    const result = mergeDailyChartRows(deposits, withdrawals);
    expect(result[0].deposits).toBe(0);
    expect(result[0].netDiff).toBe(-300);
  });

  it("sorts dates ascending", () => {
    const deposits = [
      { day_date: "2025-05-09", total: "100" },
      { day_date: "2025-05-07", total: "200" },
    ];
    const result = mergeDailyChartRows(deposits, []);
    expect(result[0].date).toBe("2025-05-07");
    expect(result[1].date).toBe("2025-05-09");
  });

  it("deduplicates overlapping dates", () => {
    const deposits = [
      { day_date: "2025-05-07", total: "100" },
      { day_date: "2025-05-07", total: "200" },
    ];
    // second row overwrites first in Map — last wins
    const result = mergeDailyChartRows(deposits, []);
    expect(result).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(mergeDailyChartRows([], [])).toEqual([]);
  });

  it("sets day='N/A' for invalid date strings", () => {
    const deposits = [{ day_date: "not-a-date", total: "100" }];
    const result = mergeDailyChartRows(deposits, []);
    expect(result[0].day).toBe("N/A");
  });
});
