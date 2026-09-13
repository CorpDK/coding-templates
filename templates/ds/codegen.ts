import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: ["./src/generated/dal/generated-schema.ts"],
  generates: {
    "../ds-sdk/src/generated/": {
      preset: "client",
      presetConfig: { fragmentMasking: false },
    },
    "./src/types/resolvers.generated.ts": {
      plugins: ["typescript", "typescript-resolvers"],
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
