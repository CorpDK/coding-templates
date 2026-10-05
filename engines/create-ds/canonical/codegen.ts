import type { CodegenConfig } from "@graphql-codegen/cli";
import { graphqlCodegenMappers } from "./src/generated/graphql-codegen.mappers.js";

/**
 * Monorepo layout: this DS package must sit beside sibling `ds-sdk` and `ds-cli`
 * packages (`../ds-sdk`, `../ds-cli`). `pnpm codegen` writes SDK and CLI artifacts
 * there. DS-only repos outside this layout must add those packages or adjust paths.
 */

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
