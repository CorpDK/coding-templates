import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { useServer } from "graphql-ws/use/ws";
import { WebSocketServer } from "ws";
import { schema } from "./schema.js";
import { connectDb } from "./db/index.js";

const PORT = Number(process.env.DS_MONGO_PORT);
if (!PORT) throw new Error("DS_MONGO_PORT env var is required");

try {
  await connectDb();
} catch (err) {
  console.error(
    "\n❌  MongoDB connection failed.\n" +
      "    Check:\n" +
      "      1. DS_MONGO_URL is correct (e.g. mongodb://localhost:27017)\n" +
      "      2. The MongoDB server is running and reachable\n" +
      "      3. DS_MONGO_DB_NAME matches an existing database\n",
    err,
  );
  process.exit(1);
}

const yoga = createYoga({
  schema,
  graphiql: process.env.NODE_ENV !== "production",
  logging: true,
});

const server = createServer(yoga);

// Attach graphql-ws WebSocket handler to the same HTTP server.
// Clients can use either SSE (Yoga built-in) or WebSocket (graphql-ws protocol).
const wsServer = new WebSocketServer({ server });
// Cast: NodeNext ESM resolution of @types/ws differs from what graphql-ws expects (CJS types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
useServer({ schema }, wsServer as any);

server.listen(PORT, () => {
  console.log(`@corpdk/ds-mongo  HTTP  http://localhost:${PORT}/graphql`);
  console.log(`@corpdk/ds-mongo  WS    ws://localhost:${PORT}/graphql`);
});
