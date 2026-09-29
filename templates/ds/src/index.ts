import { createServer } from "node:http";
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
  const base = `http://localhost:${PORT}/graphql`;
  console.log(`@corpdk/ds  HTTP  ${base}`);
  console.log(
    `@corpdk/ds  SSE   ${base}  (subscriptions: Accept: text/event-stream)`,
  );
});
