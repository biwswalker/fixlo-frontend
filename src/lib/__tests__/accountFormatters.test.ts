import { describe, it, expect } from "vitest";
import { formatAccountName, aggregateBreakdown } from "../accountFormatters";

describe("formatAccountName", () => {
  it("formats pipe-separated ID|Name", () => {
    expect(formatAccountName("juno168 | Juno Bank")).toBe("Juno Bank (juno168)");
  });

  it("returns ID when name part is empty in pipe format", () => {
    expect(formatAccountName("juno168 | ")).toBe("juno168");
  });

  it("formats numeric-only as SCB default", () => {
    expect(formatAccountName("1234567890")).toBe("ธนาคารไทยพาณิชย์ (1234567890)");
  });

  it("formats combined digit+text pattern", () => {
    expect(formatAccountName("123SomeName")).toBe("SomeName (123)");
  });

  it("returns trimmed string unchanged when no pattern matches", () => {
    expect(formatAccountName("  PlainName  ")).toBe("PlainName");
  });
});

describe("aggregateBreakdown", () => {
  it("sums rows with same formatted name", () => {
    const rows = [
      { account: "acc1 | Alpha", total: "100" },
      { account: "acc1 | Alpha", total: "50" },
    ];
    const result = aggregateBreakdown(rows);
    expect(result).toEqual([{ account: "Alpha (acc1)", total: 150 }]);
  });

  it("sorts descending by total", () => {
    const rows = [
      { account: "a | Small", total: "10" },
      { account: "b | Large", total: "999" },
      { account: "c | Mid", total: "500" },
    ];
    const result = aggregateBreakdown(rows);
    expect(result[0].account).toBe("Large (b)");
    expect(result[1].account).toBe("Mid (c)");
    expect(result[2].account).toBe("Small (a)");
  });

  it("handles empty input", () => {
    expect(aggregateBreakdown([])).toEqual([]);
  });
});
