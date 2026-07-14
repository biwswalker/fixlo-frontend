import { describe, it, expect } from "vitest";
import {
  parseHm,
  clampToBusinessStart,
  computeFrt,
  isFirstResponse,
  applyFirstReply,
  type FrtSettings,
} from "../crmFrt";

const S: FrtSettings = { opHoursStart: "08:00", opHoursEnd: "22:00", slaSeconds: 600 };

// business-local wall clock encoded as UTC
const at = (day: number, h: number, m = 0) => Date.UTC(2026, 6, day, h, m);

describe("parseHm", () => {
  it("parses HH:MM to minutes", () => {
    expect(parseHm("08:00")).toBe(480);
    expect(parseHm("22:30")).toBe(1350);
  });
});

describe("clampToBusinessStart", () => {
  it("leaves an in-hours start unchanged", () => {
    const t = at(1, 10, 0);
    expect(clampToBusinessStart(t, "08:00", "22:00")).toBe(t);
  });
  it("clamps a before-opening start to same-day opening", () => {
    expect(clampToBusinessStart(at(1, 6, 0), "08:00", "22:00")).toBe(at(1, 8, 0));
  });
  it("clamps an after-closing start to next-day opening", () => {
    expect(clampToBusinessStart(at(1, 23, 0), "08:00", "22:00")).toBe(at(2, 8, 0));
  });
});

describe("computeFrt", () => {
  it("returns nulls when there is no admin reply", () => {
    expect(computeFrt(at(1, 10, 0), null, S)).toEqual({
      frtSeconds: null,
      slaPassed: null,
    });
  });
  it("computes in-hours FRT and SLA pass", () => {
    const r = computeFrt(at(1, 10, 0), at(1, 10, 5), S); // 5 min
    expect(r.frtSeconds).toBe(300);
    expect(r.slaPassed).toBe(true);
  });
  it("fails SLA past the threshold", () => {
    const r = computeFrt(at(1, 10, 0), at(1, 10, 15), S); // 15 min
    expect(r.frtSeconds).toBe(900);
    expect(r.slaPassed).toBe(false);
  });
  it("clamps an after-hours customer message to next morning", () => {
    // customer at 23:00, admin replies next day 08:03 → 3 min
    const r = computeFrt(at(1, 23, 0), at(2, 8, 3), S);
    expect(r.frtSeconds).toBe(180);
    expect(r.slaPassed).toBe(true);
  });
  it("never goes negative (fast off-hours reply → 0)", () => {
    const r = computeFrt(at(1, 23, 0), at(1, 23, 30), S); // reply before next open
    expect(r.frtSeconds).toBe(0);
    expect(r.slaPassed).toBe(true);
  });
  it("exact threshold passes", () => {
    const r = computeFrt(at(1, 10, 0), at(1, 10, 10), S); // 600s
    expect(r.frtSeconds).toBe(600);
    expect(r.slaPassed).toBe(true);
  });
});

describe("first-responder credit", () => {
  it("first response yields an update credited to the responder", () => {
    const update = applyFirstReply(
      { frtStartAt: at(1, 10, 0), firstAdminReplyAt: null },
      at(1, 10, 5),
      42,
      S,
    );
    expect(update).toMatchObject({
      firstResponderId: 42,
      frtSeconds: 300,
      slaPassed: true,
    });
  });
  it("a later reply does not change FRT (credit is immutable)", () => {
    const session = { frtStartAt: at(1, 10, 0), firstAdminReplyAt: at(1, 10, 5) };
    expect(isFirstResponse(session)).toBe(false);
    expect(applyFirstReply(session, at(1, 10, 20), 99, S)).toBeNull();
  });
});
