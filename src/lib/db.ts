import { Pool, types } from 'pg';

// OID 1114 = timestamp without timezone. pg-types parses these as local time,
// but all our timestamp columns store UTC values. Parse as UTC to avoid a
// 7-hour shift when the process timezone is Asia/Bangkok.
types.setTypeParser(1114, (val: string) => new Date(val.replace(' ', 'T') + 'Z'));

/**
 * Database connection pool using standard environment variables.
 * Falls back to DATABASE_URL if individual parameters are missing.
 */
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432'),
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' || process.env.DATABASE_URL?.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : false,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
