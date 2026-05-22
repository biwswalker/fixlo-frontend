import { describe, it, expect } from "vitest";
import { partitionRejectResults } from "../partitionRejectResults";

describe("partitionRejectResults", () => {
  it("all success → succeeded list = all ids, failed = []", () => {
    const results = [
      { id: 1, success: true },
      { id: 2, success: true },
      { id: 3, success: true },
    ];
    expect(partitionRejectResults(results)).toEqual({ succeeded: [1, 2, 3], failed: [] });
  });

  it("all failed → succeeded = [], failed = all ids", () => {
    const results = [
      { id: 1, success: false },
      { id: 2, success: false },
    ];
    expect(partitionRejectResults(results)).toEqual({ succeeded: [], failed: [1, 2] });
  });

  it("mixed → partitions correctly", () => {
    const results = [
      { id: 1, success: true },
      { id: 2, success: false },
      { id: 3, success: true },
      { id: 4, success: false },
    ];
    expect(partitionRejectResults(results)).toEqual({ succeeded: [1, 3], failed: [2, 4] });
  });

  it("empty input → both lists empty", () => {
    expect(partitionRejectResults([])).toEqual({ succeeded: [], failed: [] });
  });
});
