import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.warn('[DB] Pool error (will use mock data):', err.message);
});

/**
 * Execute a query with automatic mock-data fallback.
 * If the database is unavailable, returns empty rows so routes
 * can fall through to their in-memory mock data.
 */
export const query = async (
  text: string,
  params?: any[]
): Promise<{ rows: any[]; rowCount: number }> => {
  try {
    const result = await pool.query(text, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  } catch (err: any) {
    console.warn('[DB] Query failed, using mock fallback:', err.message);
    return { rows: [], rowCount: 0 };
  }
};
