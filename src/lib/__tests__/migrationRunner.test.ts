import { describe, it, expect } from "vitest";
import { parseMigrationFiles, sortMigrations, isMigrationFile } from "../migrationRunner";

describe("isMigrationFile", () => {
  it("accepts NNN_name.sql", () => {
    expect(isMigrationFile("007_drop_image_hash.sql")).toBe(true);
    expect(isMigrationFile("015_unique_constraints_report_tables.sql")).toBe(true);
  });

  it("rejects rollback files", () => {
    expect(isMigrationFile("012_transfer_at_rollback.sql")).toBe(false);
    expect(isMigrationFile("013_drop_users_rollback.sql")).toBe(false);
  });

  it("rejects non-sql files", () => {
    expect(isMigrationFile("README.md")).toBe(false);
    expect(isMigrationFile("007_drop.sh")).toBe(false);
  });
});

describe("parseMigrationFiles", () => {
  it("extracts seq number and name", () => {
    const m = parseMigrationFiles(["007_drop_image_hash.sql", "015_unique_constraints_report_tables.sql"]);
    expect(m).toEqual([
      { seq: 7, filename: "007_drop_image_hash.sql" },
      { seq: 15, filename: "015_unique_constraints_report_tables.sql" },
    ]);
  });

  it("filters out rollback files automatically", () => {
    const m = parseMigrationFiles(["012_transfer_at_consolidation.sql", "012_transfer_at_rollback.sql"]);
    expect(m).toHaveLength(1);
    expect(m[0].filename).toBe("012_transfer_at_consolidation.sql");
  });
});

describe("sortMigrations", () => {
  it("sorts by seq ascending", () => {
    const input = [
      { seq: 15, filename: "015.sql" },
      { seq: 7, filename: "007.sql" },
      { seq: 12, filename: "012.sql" },
    ];
    const sorted = sortMigrations(input);
    expect(sorted.map((m) => m.seq)).toEqual([7, 12, 15]);
  });
});
