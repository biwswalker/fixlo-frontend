import { describe, it, expect } from "vitest";
import { resolveTargetProject } from "@/lib/resolveTargetProject";

describe("resolveTargetProject — state machine", () => {
  it("no caption, no note → no target, no conflict", () => {
    expect(resolveTargetProject(null, null)).toEqual({ targetProjectId: null, conflict: false });
  });

  it("caption only → use caption, no conflict", () => {
    expect(resolveTargetProject(3, null)).toEqual({ targetProjectId: 3, conflict: false });
  });

  it("note only → use note, no conflict", () => {
    expect(resolveTargetProject(null, 3)).toEqual({ targetProjectId: 3, conflict: false });
  });

  it("both same → use the value, no conflict", () => {
    expect(resolveTargetProject(3, 3)).toEqual({ targetProjectId: 3, conflict: false });
  });

  it("both different → conflict, keep caption as target", () => {
    expect(resolveTargetProject(3, 2)).toEqual({ targetProjectId: 3, conflict: true });
  });

  it("conflict: caption=juno(1), note=uno(2) → keep caption, flag conflict", () => {
    expect(resolveTargetProject(1, 2)).toEqual({ targetProjectId: 1, conflict: true });
  });
});
