const SCHEMA_TS = `import { createSchema } from "graphql-yoga";
import { typeDefs } from "./generated/generated-schema.js";
import {
  generatedResolvers,
  createDalContext,
  pubsub,
} from "./generated/dal/index.js";
import {
  otelSmokeResolvers,
  otelSmokeTestEnabled,
  otelSmokeTypeDefs,
} from "./observability/otel-smoke-extensions.js";

const resolvers = otelSmokeTestEnabled
  ? {
      ...generatedResolvers,
      Query: {
        ...generatedResolvers.Query,
        ...otelSmokeResolvers.Query,
      },
    }
  : generatedResolvers;

export const schema = createSchema({
  typeDefs: otelSmokeTestEnabled ? [typeDefs, otelSmokeTypeDefs] : typeDefs,
  resolvers,
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
import { handleHealthRequest } from "./health.js";
import { yogaTracingPlugin } from "./observability/yoga-tracing-plugin.js";

const PORT = Number(process.env.DS_PORT);
if (!PORT) throw new Error("DS_PORT env var is required");

const serverStartedAt = Date.now();

const yoga = createYoga({
  schema,
  context: () => {
    // Auth plugin would resolve actorId from session/JWT and pass it here.
    const actorId: string | null = null;
    return createRequestContext({ actorId });
  },
  graphiql: process.env.NODE_ENV !== "production",
  logging: true,
  plugins: [yogaTracingPlugin()],
});

const server = createServer((req, res) => {
  const url = req.url?.split("?")[0];
  if (url === "/health") {
    void handleHealthRequest(req, res, serverStartedAt);
    return;
  }
  yoga(req, res);
});

server.listen(PORT, () => {
  const base = \`http://localhost:\${PORT}/graphql\`;
  console.log(\`@corpdk/ds  HTTP  \${base}\`);
  console.log(\`@corpdk/ds  health  http://localhost:\${PORT}/health\`);
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
