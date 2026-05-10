#!/usr/bin/env tsx
/**
 * Migration runner — sequenced, idempotent, dry-run safe.
 *
 * Usage:
 *   tsx scripts/migrate.ts --dry-run   # print SQL without executing
 *   tsx scripts/migrate.ts --apply     # execute against DB (requires DATABASE_URL)
 *
 * Sequence (per CONTEXT.md and migration files):
 *   007–011  already shipped (skip if applied_migrations table marks them done)
 *   012  transfer_at consolidation
 *   013  drop users table + user_role enum
 *   014  drop QR columns
 *   015  UNIQUE constraints on report_* + daily_balances
 *
 * Rollback: restore from pg_dump backup, then revert app deploy.
 * Rollback SQL files: migrations/NNN_*_rollback.sql (manual apply only).
 */

import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { parseMigrationFiles, sortMigrations } from "../src/lib/migrationRunner";

config({ path: path.join(__dirname, "../.env") });

const MIGRATIONS_DIR = path.join(__dirname, "../migrations");
const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

if (!DRY_RUN && !APPLY) {
  console.error("Usage: tsx scripts/migrate.ts --dry-run | --apply");
  process.exit(1);
}

async function run() {
  const allFiles = fs.readdirSync(MIGRATIONS_DIR);
  const migrations = sortMigrations(parseMigrationFiles(allFiles));

  if (DRY_RUN) {
    console.log("=== DRY RUN — no changes will be applied ===\n");
    for (const m of migrations) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, m.filename), "utf8");
      console.log(`--- [${m.seq.toString().padStart(3, "0")}] ${m.filename} ---`);
      console.log(sql);
      console.log();
    }
    console.log(`Total: ${migrations.length} migration(s) to apply.`);
    return;
  }

  // --apply mode: requires DATABASE_URL
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        seq      integer PRIMARY KEY,
        filename text    NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const m of migrations) {
      const { rows } = await client.query(
        "SELECT 1 FROM schema_migrations WHERE seq = $1",
        [m.seq],
      );
      if (rows.length > 0) {
        console.log(`[SKIP] ${m.filename} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, m.filename), "utf8");
      console.log(`[APPLY] ${m.filename} ...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (seq, filename) VALUES ($1, $2)",
          [m.seq, m.filename],
        );
        await client.query("COMMIT");
        console.log(`[OK]   ${m.filename}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[FAIL] ${m.filename}:`, err);
        process.exit(1);
      }
    }

    console.log("\nAll migrations applied successfully.");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
