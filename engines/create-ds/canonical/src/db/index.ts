import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

/**
 * Drizzle database instance.
 *
 * The connection string is read from DATABASE_URL at startup.
 * When create-app scaffolds with a different SQL dialect (MySQL, SQLite,
 * CockroachDB), it updates drizzle.config.ts, src/db/schema/, and
 * swaps the driver package in package.json — update this file accordingly.
 */
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

export interface DbPingResult {
  connected: boolean;
  latencyMs: number | null;
}

/** Lightweight connectivity check for /health and orchestrator probes. */
export async function pingDatabase(): Promise<DbPingResult> {
  const start = performance.now();
  try {
    await pool.query("SELECT 1");
    return { connected: true, latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { connected: false, latencyMs: null };
  }
}
