import type { Types } from "@graphql-codegen/plugin-helpers";
import { buildASTSchema } from "graphql";
import type { GraphQLSchema } from "graphql";
import { extractOperations } from "./schema-utils.js";
import { generateCli } from "./gen-cli.js";
import { generateMan } from "./gen-man.js";
import { generateInfo } from "./gen-info.js";

export interface Config {
  /** Name of the env var that holds the HTTP endpoint. Default: DS_HTTP_URL */
  httpUrlEnvVar?: string;
  /** Name of the env var that holds the WebSocket endpoint. Default: DS_WS_URL */
  wsUrlEnvVar?: string;
}

export const preset: Types.OutputPreset<Config> = {
  buildGeneratesSection: (options) => {
    const { presetConfig, baseOutputDir, schemaAst, schema } = options;
    const config: Config = presetConfig ?? {};

    // schemaAst is provided by graphql-codegen when the schema is parsed.
    // Fall back to building it from the DocumentNode if needed.
    const graphqlSchema: GraphQLSchema = schemaAst ?? buildASTSchema(schema);
    const ops = extractOperations(graphqlSchema);

    return [
      {
        filename: `${baseOutputDir}index.js`,
        plugins: [{ cli: {} }],
        config: {},
        pluginMap: { cli: { plugin: () => generateCli(ops, config) } },
        schema,
        documents: [],
      },
      {
        filename: `${baseOutputDir}man/ds-cli.1`,
        plugins: [{ man: {} }],
        config: {},
        pluginMap: { man: { plugin: () => generateMan(ops) } },
        schema,
        documents: [],
      },
      {
        filename: `${baseOutputDir}info/ds-cli.texi`,
        plugins: [{ info: {} }],
        config: {},
        pluginMap: { info: { plugin: () => generateInfo(ops) } },
        schema,
        documents: [],
      },
    ] as Types.GenerateOptions[];
  },
};
