import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";
import { initStorage } from "./storage/index.js";

const PORT = Number(process.env.DS_FILE_PORT);
if (!PORT) throw new Error("DS_FILE_PORT env var is required");

await initStorage();

const yoga = createYoga({
  schema,
  graphiql: process.env.NODE_ENV !== "production",
  logging: true,
});

const server = createServer(yoga);

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}/graphql`;
  console.log(`@corpdk/ds-file  HTTP  ${base}`);
  console.log(
    `@corpdk/ds-file  SSE   ${base}  (subscriptions: Accept: text/event-stream)`,
  );
});
