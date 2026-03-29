import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { useServer } from "graphql-ws/use/ws";
import { WebSocketServer } from "ws";
import { schema } from "./schema.js";
import { connectDb } from "./db/index.js";

const PORT = Number(process.env.DS_CDB_PORT);
if (!PORT) throw new Error("DS_CDB_PORT env var is required");

try {
  await connectDb();
} catch (err) {
  console.error(
    "\n❌  Couchbase connection failed.\n" +
    "    Check:\n" +
    "      1. Your IP is allowlisted in Capella (Settings → Allowed IP Addresses)\n" +
    "      2. DS_CDB_CONNECTION_STRING, DS_CDB_USERNAME, DS_CDB_PASSWORD are correct\n" +
    "      3. The bucket and 'items' collection exist in the _default scope\n",
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
  console.log(`@corpdk/ds-cdb  HTTP  http://localhost:${PORT}/graphql`);
  console.log(`@corpdk/ds-cdb  WS    ws://localhost:${PORT}/graphql`);
});
