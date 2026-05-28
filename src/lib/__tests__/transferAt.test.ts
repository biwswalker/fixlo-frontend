import { describe, it, expect } from "vitest";
import { buildTransferAt } from "../transferAt";

// All inputs are Bangkok local; outputs are UTC ISO strings.
describe("buildTransferAt", () => {
  it("converts Bangkok local date+time to UTC ISO", () => {
    expect(buildTransferAt("2026-01-15", "14:30")).toBe("2026-01-15T07:30:00.000Z");
  });

  it("falls back to midnight Bangkok when time omitted", () => {
    expect(buildTransferAt("2026-01-15")).toBe("2026-01-14T17:00:00.000Z");
  });

  it("falls back to midnight when time is empty string", () => {
    expect(buildTransferAt("2026-01-15", "")).toBe("2026-01-14T17:00:00.000Z");
  });

  it("handles seconds in time string", () => {
    expect(buildTransferAt("2026-03-01", "09:05:30")).toBe("2026-03-01T02:05:30.000Z");
  });
});
