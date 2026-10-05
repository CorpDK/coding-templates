import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

/**
 * Drizzle database instance.
 *
 * The connection string is read from DATABASE_URL at startup.
 * When create-app or create-ds scaffolds with a different SQL dialect (MySQL, SQLite,
 * CockroachDB), update drizzle.config.ts, src/db/schema/, and the driver here.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
