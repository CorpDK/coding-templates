import { emitCliModules } from "../../../codegen/index.js";
import { fixtureSchema } from "./schema.js";

/** Catalog and runtime config produced by the real C-P1 codegen. */
const generated = emitCliModules(fixtureSchema, {
  bin: "fixture-cli",
  transport: {
    httpUrlEnv: "FIXTURE_HTTP_URL",
    tokenEnv: "FIXTURE_TOKEN",
    headersEnv: "FIXTURE_HEADERS_JSON",
    timeoutMs: 2_000,
  },
  pagination: { defaultPageSize: 2 },
});

export const fixtureCatalog = Object.fromEntries(
  generated.commands.map((cmd) => [cmd.command, cmd]),
);

export const fixtureConfig = generated.runtimeConfig;
