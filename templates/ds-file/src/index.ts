import {
  createSseYogaHttpServer,
  listenSseYogaHttpServer,
} from "@corpdk/pub-sub";
import { schema } from "./schema.js";
import { initStorage } from "./storage/index.js";

const PORT = Number(process.env.DS_FILE_PORT);
if (!PORT) throw new Error("DS_FILE_PORT env var is required");

await initStorage();

const server = createSseYogaHttpServer(schema);
listenSseYogaHttpServer(server, PORT, "@corpdk/ds-file");
