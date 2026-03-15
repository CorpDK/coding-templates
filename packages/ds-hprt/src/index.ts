import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { useServer } from "graphql-ws/lib/use/ws";
import { WebSocketServer } from "ws";
import { schema } from "./schema.js";

const PORT = Number(process.env.DS_HPRT_PORT);
if (!PORT) throw new Error("DS_HPRT_PORT env var is required");

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
  console.log(`@corpdk/ds-hprt  HTTP  http://localhost:${PORT}/graphql`);
  console.log(`@corpdk/ds-hprt  WS    ws://localhost:${PORT}/graphql`);
});
