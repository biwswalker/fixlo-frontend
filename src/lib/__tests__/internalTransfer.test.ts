import { describe, it, expect } from "vitest";
import { aggregateInternalTransferByAccountDay, type InternalTransferRow } from "../internalTransfer";

function row(receiving_account_id: string, date: string, amount: number): InternalTransferRow {
  return { receiving_account_id, date, amount };
}

describe("aggregateInternalTransferByAccountDay", () => {
  it("empty input → empty map", () => {
    const result = aggregateInternalTransferByAccountDay([]);
    expect(result.size).toBe(0);
  });

  it("single row → correct account+date total", () => {
    const result = aggregateInternalTransferByAccountDay([
      row("acc-b", "2026-06-11", 49800),
    ]);
    expect(result.get("acc-b")?.get("2026-06-11")).toBe(49800);
  });

  it("two rows same account+date → sum", () => {
    const result = aggregateInternalTransferByAccountDay([
      row("acc-b", "2026-06-11", 20000),
      row("acc-b", "2026-06-11", 30000),
    ]);
    expect(result.get("acc-b")?.get("2026-06-11")).toBe(50000);
  });

  it("same account different dates → separate totals", () => {
    const result = aggregateInternalTransferByAccountDay([
      row("acc-b", "2026-06-10", 10000),
      row("acc-b", "2026-06-11", 20000),
    ]);
    expect(result.get("acc-b")?.get("2026-06-10")).toBe(10000);
    expect(result.get("acc-b")?.get("2026-06-11")).toBe(20000);
  });

  it("different accounts → separate maps", () => {
    const result = aggregateInternalTransferByAccountDay([
      row("acc-b", "2026-06-11", 10000),
      row("acc-c", "2026-06-11", 5000),
    ]);
    expect(result.get("acc-b")?.get("2026-06-11")).toBe(10000);
    expect(result.get("acc-c")?.get("2026-06-11")).toBe(5000);
  });

  it("amount as string is parsed to number", () => {
    const result = aggregateInternalTransferByAccountDay([
      { receiving_account_id: "acc-b", date: "2026-06-11", amount: "49800" as unknown as number },
    ]);
    expect(result.get("acc-b")?.get("2026-06-11")).toBe(49800);
  });
});
