import type { CodegenConfig } from "@graphql-codegen/cli";
import { graphqlCodegenMappers } from "./src/generated/dal/graphql-codegen.mappers.js";

const config: CodegenConfig = {
  schema: ["./src/generated/generated-schema.ts"],
  generates: {
    "../ds-sdk/src/generated/": {
      preset: "client",
      presetConfig: { fragmentMasking: false },
    },
    "./src/generated/graphql/resolvers.generated.ts": {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        contextType: "../dal/resolvers/generated-resolvers.js#DalContext",
        useTypeImports: true,
        mappers: { ...graphqlCodegenMappers },
      },
    },
    "../ds-cli/src/generated/": {
      preset: "@corpdk/codegen-cli",
      presetConfig: {
        httpUrlEnvVar: "DS_HTTP_URL",
        wsUrlEnvVar: "DS_WS_URL",
      },
    },
  },
};

export default config;
