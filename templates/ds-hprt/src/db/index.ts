import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../drizzle/schema.js";

/**
 * Drizzle database instance.
 *
 * The connection string is read from DS_HPRT_DATABASE_URL at startup.
 * When create-app scaffolds with a different SQL dialect (MySQL, SQLite,
 * CockroachDB), it updates drizzle.config.ts, drizzle/schema.ts, and
 * swaps the driver package in package.json — update this file accordingly.
 */
const pool = new Pool({ connectionString: process.env.DS_HPRT_DATABASE_URL });

export const db = drizzle(pool, { schema });
