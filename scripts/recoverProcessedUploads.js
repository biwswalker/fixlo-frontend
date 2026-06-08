#!/usr/bin/env node
/**
 * Recovery for issue #115:
 * raw_uploads.ai_status='PROCESSED' but no downstream transactions/daily_balances
 * row exists for the same image_path.
 *
 * Dry-run is the default. Use --apply to reset matching uploads back to PENDING;
 * fixlo-spectre remains responsible for enqueueing and processing them.
 */

const fs = require("fs");
const path = require("path");
const { config } = require("dotenv");
const pg = require("pg");

config({ path: path.join(__dirname, "../.env") });

const usage = `
Usage:
  node scripts/recoverProcessedUploads.js --from YYYY-MM-DD --to YYYY-MM-DD [--apply]

Examples:
  npm run recovery:processed-missing:dry -- --from 2026-06-01 --to 2026-06-03
  npm run recovery:processed-missing:apply -- --from 2026-06-01 --to 2026-06-03

Notes:
  - Dates are Bangkok dates derived from raw_uploads.created_at.
  - Dry-run is default and performs no writes.
  - --apply writes a JSON audit snapshot to scratch/ before updating rows.
`;

function parseArgs(argv) {
  const args = { apply: false, from: null, to: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--dry-run") {
      args.apply = false;
    } else if (arg === "--from") {
      args.from = argv[++i] ?? null;
    } else if (arg === "--to") {
      args.to = argv[++i] ?? null;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage.trim());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function assertDate(label, value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} is required in YYYY-MM-DD format`);
  }
}

function snapshotPath(from, to) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(
    __dirname,
    "../scratch",
    `recovery-processed-missing-${from}_${to}-${stamp}.json`,
  );
}

const candidateSql = `
  SELECT
    ru.id,
    to_char(ru.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS created_at_utc,
    to_char((ru.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date, 'YYYY-MM-DD') AS created_bkk_date,
    to_char(ru.target_date, 'YYYY-MM-DD') AS target_date,
    ru.source_project_id,
    sp.code AS source_project_code,
    ru.target_project_id,
    tp.code AS target_project_code,
    ru.discord_message_id,
    ru.image_path
  FROM raw_uploads ru
  LEFT JOIN projects sp ON sp.id = ru.source_project_id
  LEFT JOIN projects tp ON tp.id = ru.target_project_id
  WHERE ru.ai_status = 'PROCESSED'
    AND (ru.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date
    AND NOT EXISTS (
      SELECT 1 FROM transactions t WHERE t.image_path = ru.image_path
    )
    AND NOT EXISTS (
      SELECT 1 FROM daily_balances db WHERE db.image_path = ru.image_path
    )
  ORDER BY ru.id
`;

function summarize(candidates) {
  const byDateProject = new Map();
  for (const row of candidates) {
    const key = `${row.created_bkk_date} | ${row.source_project_code ?? "unknown"}`;
    byDateProject.set(key, (byDateProject.get(key) ?? 0) + 1);
  }

  return [...byDateProject.entries()].map(([key, count]) => {
    const [created_bkk_date, source_project_code] = key.split(" | ");
    return { created_bkk_date, source_project_code, count };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertDate("--from", args.from);
  assertDate("--to", args.to);
  if (args.from > args.to) {
    throw new Error("--from must be earlier than or equal to --to");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(args.apply ? "BEGIN" : "BEGIN READ ONLY");

    const result = await client.query(
      args.apply ? `${candidateSql}\n  FOR UPDATE OF ru` : candidateSql,
      [args.from, args.to],
    );
    const candidates = result.rows;
    const summary = summarize(candidates);

    console.log(
      JSON.stringify(
        {
          mode: args.apply ? "apply" : "dry-run",
          window: {
            basis: "raw_uploads.created_at Bangkok date",
            from: args.from,
            to: args.to,
          },
          candidateCount: candidates.length,
          summary,
          sample: candidates.slice(0, 20),
        },
        null,
        2,
      ),
    );

    if (!args.apply) {
      await client.query("ROLLBACK");
      return;
    }

    const outPath = snapshotPath(args.from, args.to);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          window: {
            basis: "raw_uploads.created_at Bangkok date",
            from: args.from,
            to: args.to,
          },
          candidateCount: candidates.length,
          candidates,
        },
        null,
        2,
      ),
    );

    if (candidates.length === 0) {
      await client.query("COMMIT");
      console.log(`No rows updated. Snapshot written: ${outPath}`);
      return;
    }

    const ids = candidates.map((row) => row.id);
    const update = await client.query(
      `
        UPDATE raw_uploads ru
        SET ai_status = 'PENDING'
        WHERE ru.id = ANY($1::int[])
          AND ru.ai_status = 'PROCESSED'
          AND NOT EXISTS (
            SELECT 1 FROM transactions t WHERE t.image_path = ru.image_path
          )
          AND NOT EXISTS (
            SELECT 1 FROM daily_balances db WHERE db.image_path = ru.image_path
          )
        RETURNING ru.id
      `,
      [ids],
    );

    if (update.rowCount !== candidates.length) {
      await client.query("ROLLBACK");
      throw new Error(
        `Safety check failed: selected ${candidates.length} candidates but updated ${update.rowCount}. Snapshot written: ${outPath}; DB rolled back.`,
      );
    }

    await client.query("COMMIT");
    console.log(`Updated ${update.rowCount} raw_uploads rows to PENDING.`);
    console.log(`Audit snapshot written: ${outPath}`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures; surface the original error.
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
