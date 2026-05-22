import { describe, it, expect } from "vitest";
import { nextState, TxnStatus, TxnAction } from "../transactionState";

// RED: all fail until module is implemented
describe("nextState — auto-match score routing", () => {
  it("score >= 85 → AUTO_MAPPED", () => {
    const result = nextState({ current: "UNMAPPED", action: "auto_match", actorRole: "admin", score: 90 });
    expect(result).toEqual({ next: "AUTO_MAPPED" });
  });

  it("score 50–84 → PENDING_REVIEW", () => {
    const result = nextState({ current: "UNMAPPED", action: "auto_match", actorRole: "admin", score: 60 });
    expect(result).toEqual({ next: "PENDING_REVIEW" });
  });

  it("score < 50 → UNMAPPED", () => {
    const result = nextState({ current: "UNMAPPED", action: "auto_match", actorRole: "admin", score: 20 });
    expect(result).toEqual({ next: "UNMAPPED" });
  });
});

describe("nextState — staff can confirm PENDING_REVIEW", () => {
  it("staff confirm PENDING_REVIEW → MANUAL_MAPPED", () => {
    const result = nextState({ current: "PENDING_REVIEW", action: "confirm_mapping", actorRole: "staff" });
    expect(result).toEqual({ next: "MANUAL_MAPPED" });
  });

  it("staff can confirm UNMAPPED → MANUAL_MAPPED", () => {
    const result = nextState({ current: "UNMAPPED", action: "confirm_mapping", actorRole: "staff" });
    expect(result).toEqual({ next: "MANUAL_MAPPED" });
  });
});

describe("nextState — viewer is always forbidden", () => {
  it("viewer cannot confirm", () => {
    const result = nextState({ current: "PENDING_REVIEW", action: "confirm_mapping", actorRole: "viewer" });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("viewer cannot force approve", () => {
    const result = nextState({ current: "PENDING_REVIEW", action: "force_approve", actorRole: "viewer" });
    expect(result).toEqual({ error: "forbidden" });
  });
});

describe("nextState — admin/owner force approve from any state", () => {
  const states: TxnStatus[] = ["UNMAPPED", "PENDING_REVIEW", "MANUAL_MAPPED", "AUTO_MAPPED"];

  for (const role of ["admin", "owner"] as const) {
    for (const current of states) {
      it(`${role} force_approve from ${current} → MANUAL_MAPPED`, () => {
        const result = nextState({ current, action: "force_approve", actorRole: role });
        expect(result).toEqual({ next: "MANUAL_MAPPED" });
      });
    }
  }
});

describe("nextState — staff cannot force approve", () => {
  it("staff force_approve → forbidden", () => {
    const result = nextState({ current: "PENDING_REVIEW", action: "force_approve", actorRole: "staff" });
    expect(result).toEqual({ error: "forbidden" });
  });
});

describe("nextState — admin can confirm PENDING_REVIEW", () => {
  it("admin confirm PENDING_REVIEW → MANUAL_MAPPED", () => {
    const result = nextState({ current: "PENDING_REVIEW", action: "confirm_mapping", actorRole: "admin" });
    expect(result).toEqual({ next: "MANUAL_MAPPED" });
  });
});

describe("nextState — reject action", () => {
  it("admin reject PENDING_REVIEW → REJECTED", () => {
    const result = nextState({ current: "PENDING_REVIEW", action: "reject", actorRole: "admin" });
    expect(result).toEqual({ next: "REJECTED" });
  });

  it("owner reject UNMAPPED → REJECTED", () => {
    const result = nextState({ current: "UNMAPPED", action: "reject", actorRole: "owner" });
    expect(result).toEqual({ next: "REJECTED" });
  });

  it("admin reject AUTO_MAPPED → REJECTED (confirmed slip can be rejected)", () => {
    const result = nextState({ current: "AUTO_MAPPED", action: "reject", actorRole: "admin" });
    expect(result).toEqual({ next: "REJECTED" });
  });

  it("owner reject AUTO_MAPPED → REJECTED", () => {
    const result = nextState({ current: "AUTO_MAPPED", action: "reject", actorRole: "owner" });
    expect(result).toEqual({ next: "REJECTED" });
  });

  it("admin reject MANUAL_MAPPED → REJECTED (confirmed slip can be rejected)", () => {
    const result = nextState({ current: "MANUAL_MAPPED", action: "reject", actorRole: "admin" });
    expect(result).toEqual({ next: "REJECTED" });
  });

  it("staff reject AUTO_MAPPED → forbidden (no manage_projects)", () => {
    const result = nextState({ current: "AUTO_MAPPED", action: "reject", actorRole: "staff" });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("REJECTED is terminal — admin reject REJECTED → invalid-transition", () => {
    const result = nextState({ current: "REJECTED", action: "reject", actorRole: "admin" });
    expect(result).toEqual({ error: "invalid-transition" });
  });

  it("staff reject → forbidden", () => {
    const result = nextState({ current: "PENDING_REVIEW", action: "reject", actorRole: "staff" });
    expect(result).toEqual({ error: "forbidden" });
  });

  it("viewer reject → forbidden", () => {
    const result = nextState({ current: "PENDING_REVIEW", action: "reject", actorRole: "viewer" });
    expect(result).toEqual({ error: "forbidden" });
  });
});
