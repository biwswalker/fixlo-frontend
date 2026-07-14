import { Pool, types } from 'pg';

// OID 1114 = timestamp without timezone. pg-types parses these as local time,
// but all our timestamp columns store UTC values. Parse as UTC to avoid a
// 7-hour shift when the process timezone is Asia/Bangkok.
types.setTypeParser(1114, (val: string) => new Date(val.replace(' ', 'T') + 'Z'));

// SSL when DB_SSL=true or the URL requests sslmode=require.
const ssl =
  process.env.DB_SSL === 'true' ||
  process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false;

/**
 * Database connection pool.
 *
 * When DATABASE_URL is set it is authoritative — we pass ONLY the connection
 * string, never mixing it with the individual DB_* params. Mixing them lets a
 * defaulted field (e.g. `port` falling back to 5432) silently override the
 * port/host encoded in the URL, which breaks any environment that provides only
 * DATABASE_URL. Without a URL, fall back to the individual DB_* variables.
 */
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl }
    : {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || process.env.DB_PASS,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl,
      },
);

export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params);

export default pool;
