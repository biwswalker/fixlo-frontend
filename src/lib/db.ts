import { Pool } from 'pg';

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
