import { describe, it, expect } from "vitest";
import { buildTransferAt } from "../transferAt";

describe("buildTransferAt", () => {
  it("combines date + time into naive timestamp string", () => {
    expect(buildTransferAt("2026-01-15", "14:30")).toBe("2026-01-15 14:30:00");
  });

  it("falls back to midnight when time omitted", () => {
    expect(buildTransferAt("2026-01-15")).toBe("2026-01-15 00:00:00");
  });

  it("falls back to midnight when time is empty string", () => {
    expect(buildTransferAt("2026-01-15", "")).toBe("2026-01-15 00:00:00");
  });

  it("handles seconds in time string", () => {
    expect(buildTransferAt("2026-03-01", "09:05:30")).toBe("2026-03-01 09:05:30");
  });
});
