import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
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

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}/graphql`;
  console.log(`@corpdk/ds-cdb  HTTP  ${base}`);
  console.log(
    `@corpdk/ds-cdb  SSE   ${base}  (subscriptions: Accept: text/event-stream)`,
  );
});
