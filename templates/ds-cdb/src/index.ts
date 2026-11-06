import {
  createSseYogaHttpServer,
  listenSseYogaHttpServer,
} from "@corpdk/pub-sub";
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

const server = createSseYogaHttpServer(schema);
listenSseYogaHttpServer(server, PORT, "@corpdk/ds-cdb");
