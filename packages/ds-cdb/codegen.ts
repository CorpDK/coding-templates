import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./src/schema.ts",
  generates: {
    // Client SDK — TypedDocumentNode works with Apollo Client and urql
    "../ds-sdk-cdb/src/generated/": {
      preset: "client",
      presetConfig: { fragmentMasking: false },
    },
    // Server-side resolver types
    "./src/types/resolvers.generated.ts": {
      plugins: ["typescript", "typescript-resolvers"],
    },
  },
};

export default config;
