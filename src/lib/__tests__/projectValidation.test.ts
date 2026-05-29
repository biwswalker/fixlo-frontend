import { describe, it, expect } from "vitest";
import {
  validateCode,
  validateAliases,
  checkCollision,
  type ProjectRow,
} from "../projectValidation";

describe("validateCode", () => {
  it("accepts valid lowercase alphanumeric codes", () => {
    expect(validateCode("juno168")).toBeNull();
    expect(validateCode("ab")).toBeNull();
    expect(validateCode("abc123")).toBeNull();
    expect(validateCode("a".repeat(32))).toBeNull();
  });

  it("rejects code shorter than 2 chars", () => {
    expect(validateCode("a")).not.toBeNull();
    expect(validateCode("")).not.toBeNull();
  });

  it("rejects code longer than 32 chars", () => {
    expect(validateCode("a".repeat(33))).not.toBeNull();
  });

  it("rejects uppercase letters", () => {
    expect(validateCode("Juno168")).not.toBeNull();
    expect(validateCode("JUNO")).not.toBeNull();
  });

  it("rejects special characters", () => {
    expect(validateCode("juno-168")).not.toBeNull();
    expect(validateCode("juno_168")).not.toBeNull();
    expect(validateCode("juno 168")).not.toBeNull();
  });
});

describe("validateAliases", () => {
  it("accepts empty array", () => {
    expect(validateAliases([])).toBeNull();
  });

  it("accepts valid alias array", () => {
    expect(validateAliases(["juno", "jn"])).toBeNull();
    expect(validateAliases(["ab"])).toBeNull();
  });

  it("rejects alias shorter than 2 chars", () => {
    expect(validateAliases(["j"])).not.toBeNull();
  });

  it("rejects alias longer than 32 chars", () => {
    expect(validateAliases(["a".repeat(33)])).not.toBeNull();
  });

  it("rejects alias with invalid charset", () => {
    expect(validateAliases(["juno-168"])).not.toBeNull();
    expect(validateAliases(["Juno"])).not.toBeNull();
  });
});

const EXISTING: ProjectRow[] = [
  { id: 1, code: "juno168", aliases: ["juno", "jn"] },
  { id: 2, code: "uno168",  aliases: ["uno"] },
  { id: 3, code: "gaza168", aliases: ["gaza"] },
];

describe("checkCollision", () => {
  it("returns null when no collision", () => {
    expect(checkCollision("yb168", ["yb"], EXISTING)).toBeNull();
  });

  it("detects code collision with another project's code", () => {
    expect(checkCollision("juno168", [], EXISTING)).not.toBeNull();
  });

  it("detects code collision with another project's alias", () => {
    // 'juno' is an alias of project 1 — cannot use as code for new project
    expect(checkCollision("juno", [], EXISTING)).not.toBeNull();
  });

  it("detects alias collision with another project's code", () => {
    expect(checkCollision("newcode", ["juno168"], EXISTING)).not.toBeNull();
  });

  it("detects alias collision with another project's alias", () => {
    expect(checkCollision("newcode", ["juno"], EXISTING)).not.toBeNull();
  });

  it("allows edit-self: excludes own project from collision check", () => {
    // Editing project id=1 — its own code/aliases should not collide with itself
    expect(checkCollision("juno168", ["juno", "jn"], EXISTING, 1)).toBeNull();
  });

  it("still detects collision with OTHER projects when editing self", () => {
    expect(checkCollision("uno168", ["uno"], EXISTING, 1)).not.toBeNull();
  });
});
