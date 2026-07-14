import { describe, it, expect } from "vitest";
import { startsNewSession, assignSessions } from "../crmSession";

const MIN = 60_000;

describe("startsNewSession", () => {
  it("always starts a session for the first message", () => {
    expect(startsNewSession(null, 1000, 360)).toBe(true);
  });

  it("stays in session within the gap, starts new beyond it", () => {
    const base = 1_000_000;
    expect(startsNewSession(base, base + 60 * MIN, 360)).toBe(false); // 1h < 6h
    expect(startsNewSession(base, base + 360 * MIN, 360)).toBe(false); // exactly 6h, not >
    expect(startsNewSession(base, base + 361 * MIN, 360)).toBe(true); // > 6h
  });
});

describe("assignSessions", () => {
  it("returns an empty array for no messages", () => {
    expect(assignSessions([], 360)).toEqual([]);
  });

  it("puts a single message in session 0", () => {
    const out = assignSessions([{ userId: "u1", at: 0 }], 360);
    expect(out[0].sessionIndex).toBe(0);
  });

  it("increments the index when the gap is exceeded", () => {
    const out = assignSessions(
      [
        { userId: "u1", at: 0 },
        { userId: "u1", at: 60 * MIN }, // +1h → same
        { userId: "u1", at: 60 * MIN + 400 * MIN }, // +>6h → new
      ],
      360,
    );
    expect(out.map((m) => m.sessionIndex)).toEqual([0, 0, 1]);
  });

  it("isolates sessions per customer", () => {
    const out = assignSessions(
      [
        { userId: "u1", at: 0 },
        { userId: "u2", at: 10 * MIN },
        { userId: "u1", at: 500 * MIN }, // u1 new session
        { userId: "u2", at: 20 * MIN }, // u2 same session
      ],
      360,
    );
    const byRef = new Map(out.map((m, i) => [i, m.sessionIndex]));
    expect(byRef.get(0)).toBe(0); // u1 first
    expect(byRef.get(1)).toBe(0); // u2 first
    expect(byRef.get(2)).toBe(1); // u1 second session
    expect(byRef.get(3)).toBe(0); // u2 still first
  });

  it("handles unsorted input by ordering per customer in time", () => {
    const out = assignSessions(
      [
        { userId: "u1", at: 500 * MIN },
        { userId: "u1", at: 0 },
      ],
      360,
    );
    // earliest (index 1) is session 0, later (index 0) is session 1
    expect(out[1].sessionIndex).toBe(0);
    expect(out[0].sessionIndex).toBe(1);
  });

  it("preserves input order and shape", () => {
    const input = [{ userId: "u1", at: 0, extra: "x" }];
    const out = assignSessions(input, 360);
    expect(out[0]).toMatchObject({ userId: "u1", at: 0, extra: "x", sessionIndex: 0 });
  });
});
