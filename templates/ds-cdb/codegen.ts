import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./src/schema/**/*.graphqls",
  generates: {
    // Client SDK — TypedDocumentNode works with Apollo Client and urql
    "../ds-sdk/src/generated/": {
      preset: "client",
      presetConfig: { fragmentMasking: false },
    },
    // Server-side resolver types
    "./src/types/resolvers.generated.ts": {
      plugins: ["typescript", "typescript-resolvers"],
    },
    // CLI for automation and LLM access
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
