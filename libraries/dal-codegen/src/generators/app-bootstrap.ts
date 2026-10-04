const SCHEMA_TS = `import { createSchema } from "graphql-yoga";
import { typeDefs } from "./generated/generated-schema.js";
import {
  generatedResolvers,
  createDalContext,
  pubsub,
} from "./generated/dal/index.js";

export const schema = createSchema({
  typeDefs,
  resolvers: generatedResolvers,
});

export interface RequestContextOptions {
  /** Set by auth plugin from session/token; null until auth is wired. */
  actorId?: string | null;
}

export function createRequestContext(options?: RequestContextOptions) {
  return createDalContext(pubsub, { actorId: options?.actorId ?? null });
}
`;

const INDEX_TS = `import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema, createRequestContext } from "./schema.js";

const PORT = Number(process.env.DS_PORT);
if (!PORT) throw new Error("DS_PORT env var is required");

const yoga = createYoga({
  schema,
  context: () => {
    // Auth plugin would resolve actorId from session/JWT and pass it here.
    const actorId: string | null = null;
    return createRequestContext({ actorId });
  },
  graphiql: process.env.NODE_ENV !== "production",
  logging: true,
});

const server = createServer(yoga);

server.listen(PORT, () => {
  const base = \`http://localhost:\${PORT}/graphql\`;
  console.log(\`@corpdk/ds  HTTP  \${base}\`);
  console.log(
    \`@corpdk/ds  SSE   \${base}  (subscriptions: Accept: text/event-stream)\`,
  );
});
`;

const DB_INDEX_TS = `import { drizzle } from "drizzle-orm/node-postgres";
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
`;

/** Emits thin Yoga/schema bootstrap files (no entity SDL). */
export function generateAppBootstrapFiles(): {
  schemaTs: string;
  indexTs: string;
  dbIndexTs: string;
} {
  return {
    schemaTs: SCHEMA_TS,
    indexTs: INDEX_TS,
    dbIndexTs: DB_INDEX_TS,
  };
}
