import { describe, it, expect } from "vitest";
import { normalizeTransferAt } from "../normalizeTransferAt";

describe("normalizeTransferAt — always returns UTC ISO string", () => {
  it("Date instance → toISOString()", () => {
    const d = new Date("2026-05-22T00:14:00.000Z");
    expect(normalizeTransferAt(d)).toBe("2026-05-22T00:14:00.000Z");
  });

  it("string without timezone → treated as Bangkok (UTC+7) → UTC ISO", () => {
    // Bangkok midnight 00:14 = UTC 17:14 previous day
    expect(normalizeTransferAt("2026-05-22 00:14:00")).toBe("2026-05-21T17:14:00.000Z");
  });

  it("string with space separator + +07:00 offset → UTC ISO", () => {
    expect(normalizeTransferAt("2026-05-22 00:14:00+07:00")).toBe("2026-05-21T17:14:00.000Z");
  });

  it("string with +07 short offset → UTC ISO", () => {
    expect(normalizeTransferAt("2026-05-22 00:14:00+07")).toBe("2026-05-21T17:14:00.000Z");
  });

  it("already UTC Z string → passes through unchanged", () => {
    expect(normalizeTransferAt("2026-05-21T17:14:00.000Z")).toBe("2026-05-21T17:14:00.000Z");
  });

  it("Bangkok noon → UTC 05:00", () => {
    expect(normalizeTransferAt("2026-05-22 12:00:00")).toBe("2026-05-22T05:00:00.000Z");
  });
});
