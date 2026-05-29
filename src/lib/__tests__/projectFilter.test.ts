import { describe, it, expect } from "vitest";
import { nameOrAll, nameOrAllParams, idOrAll } from "../projectFilter";

describe("nameOrAll", () => {
  it("produces correct SQL fragment with given param indices", () => {
    expect(nameOrAll(1, 2)).toBe(
      "(project_id ILIKE '%' || $1 || '%' OR $2 = true)",
    );
  });

  it("accepts arbitrary param indices", () => {
    expect(nameOrAll(3, 4)).toBe(
      "(project_id ILIKE '%' || $3 || '%' OR $4 = true)",
    );
  });
});

describe("nameOrAllParams", () => {
  it("returns name and isAll=false for specific project", () => {
    expect(nameOrAllParams("juno168", false)).toEqual(["juno168", false]);
  });

  it("returns empty string and isAll=true for all view", () => {
    expect(nameOrAllParams(null, true)).toEqual(["", true]);
  });

  it("handles undefined project name", () => {
    expect(nameOrAllParams(undefined, false)).toEqual(["", false]);
  });
});

describe("idOrAll", () => {
  it("produces correct SQL fragment with integer project_id", () => {
    expect(idOrAll(1, 2)).toBe("(project_id = $1 OR $2 = true)");
  });

  it("accepts arbitrary param indices", () => {
    expect(idOrAll(3, 4)).toBe("(project_id = $3 OR $4 = true)");
  });
});
