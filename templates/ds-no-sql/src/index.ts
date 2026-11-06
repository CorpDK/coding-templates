import {
  createSseYogaHttpServer,
  listenSseYogaHttpServer,
} from "@corpdk/pub-sub";
import { schema } from "./schema.js";

const PORT = Number(process.env.DS_NO_SQL_PORT);
if (!PORT) throw new Error("DS_NO_SQL_PORT env var is required");

const server = createSseYogaHttpServer(schema);
listenSseYogaHttpServer(server, PORT, "@corpdk/ds-no-sql");
