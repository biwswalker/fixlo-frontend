import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function runMigrations() {
  const migrationsDir = path.join(process.cwd(), 'db/migrations');
  if (!fs.existsSync(migrationsDir)) {
      console.error("Migrations directory not found");
      return;
  }
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (file.endsWith('.sql')) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await pool.query(sql);
        console.log(`Migration ${file} completed successfully.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error running migration ${file}:`, message);
      }
    }
  }
  await pool.end();
}

runMigrations();
