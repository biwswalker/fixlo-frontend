import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveProject } from "../projects";

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

import { query } from "@/lib/db";
const mockQuery = vi.mocked(query);

const DB_ROWS = [
  { id: 1, code: "juno168", project_name: "juno168", aliases: ["juno", "jn"] },
  { id: 2, code: "uno168",  project_name: "uno168",  aliases: ["uno"] },
  { id: 3, code: "gaza168", project_name: "gaza168", aliases: ["gaza"] },
  { id: 4, code: "yb168",   project_name: "yb168",   aliases: ["yb"] },
];

function setupQueryMock() {
  mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    const slug = String(params?.[0] ?? "").toLowerCase();
    // exact code match
    let row = DB_ROWS.find(r => r.code.toLowerCase() === slug);
    // alias fallback
    if (!row) row = DB_ROWS.find(r => r.aliases.map(a => a.toLowerCase()).includes(slug));
    return { rows: row ? [row] : [] } as any;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupQueryMock();
});

describe("resolveProject", () => {
  it("returns null for 'all'", async () => {
    expect(await resolveProject("all")).toBeNull();
  });

  it("returns null for empty slug", async () => {
    expect(await resolveProject("")).toBeNull();
  });

  it("resolves exact code match", async () => {
    const ref = await resolveProject("juno168");
    expect(ref).toEqual({ id: 1, code: "juno168", name: "juno168" });
  });

  it("resolves alias match", async () => {
    const ref = await resolveProject("juno");
    expect(ref).toEqual({ id: 1, code: "juno168", name: "juno168" });
  });

  it("resolves 'uno' to id=2, NOT id=1 — regression for ILIKE bug", async () => {
    const ref = await resolveProject("uno");
    expect(ref?.id).toBe(2);
    expect(ref?.code).toBe("uno168");
  });

  it("resolves case-insensitive code", async () => {
    const ref = await resolveProject("JUNO168");
    expect(ref?.id).toBe(1);
  });

  it("returns null for unknown slug", async () => {
    expect(await resolveProject("nonexistent")).toBeNull();
  });
});
