/**
 * Postgres pool — only used when DATABASE_URL is set.
 * Local demo without Neon uses the in-memory store (see store.ts).
 */
import { Pool } from "pg";

let pool: Pool | null = null;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Use getStore() which falls back to in-memory when missing."
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon / serverless-friendly
      ssl:
        process.env.DATABASE_URL.includes("localhost") ||
        process.env.DATABASE_URL.includes("127.0.0.1")
          ? undefined
          : { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}
