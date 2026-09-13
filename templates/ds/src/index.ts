import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { useServer } from "graphql-ws/use/ws";
import { WebSocketServer } from "ws";
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

const wsServer = new WebSocketServer({ server });
// Cast: NodeNext ESM resolution of @types/ws differs from what graphql-ws expects (CJS types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
useServer(
  {
    schema,
    context: () => {
      const actorId: string | null = null;
      return createRequestContext({ actorId });
    },
  },
  wsServer as any,
);

server.listen(PORT, () => {
  console.log(`@corpdk/ds  HTTP  http://localhost:${PORT}/graphql`);
  console.log(`@corpdk/ds  WS    ws://localhost:${PORT}/graphql`);
});
