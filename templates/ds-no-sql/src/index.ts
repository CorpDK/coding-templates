import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";

const PORT = Number(process.env.DS_NO_SQL_PORT);
if (!PORT) throw new Error("DS_NO_SQL_PORT env var is required");

const yoga = createYoga({
  schema,
  graphiql: process.env.NODE_ENV !== "production",
  logging: true,
});

const server = createServer(yoga);

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}/graphql`;
  console.log(`@corpdk/ds-no-sql  HTTP  ${base}`);
  console.log(
    `@corpdk/ds-no-sql  SSE   ${base}  (subscriptions: Accept: text/event-stream)`,
  );
});
