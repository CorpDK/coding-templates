import {
  createSseYogaHttpServer,
  listenSseYogaHttpServer,
} from "@corpdk/pub-sub";
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

const server = createSseYogaHttpServer(schema);
listenSseYogaHttpServer(server, PORT, "@corpdk/ds-mongo");
