/**
 * Data access entrypoint.
 *
 * - If DATABASE_URL is set → Postgres (Neon) via parameterized SQL.
 * - If DATABASE_URL is missing → in-memory store for local demo without Neon.
 */
import { hasDatabaseUrl } from "./pool";
import { MemoryStore } from "./memory";
import { PostgresStore } from "./postgres";
import type { DataStore } from "./store";

export type { DataStore } from "./store";
export { getPool, hasDatabaseUrl } from "./pool";
export { resetMemoryStore } from "./memory";

let store: DataStore | null = null;

/**
 * Returns the active store (singleton). Safe to call from route handlers.
 */
export function getStore(): DataStore {
  if (store) return store;

  if (hasDatabaseUrl()) {
    store = new PostgresStore();
    return store;
  }

  // --- In-memory fallback (no DATABASE_URL) ---
  // Local demo works without Neon. Data is process-local and resets on restart.
  console.warn(
    "[db] DATABASE_URL not set — using in-memory store (demo only, not durable)."
  );
  store = new MemoryStore();
  return store;
}

/** Force-recreate store (tests). */
export function resetStore(): void {
  store = null;
}
