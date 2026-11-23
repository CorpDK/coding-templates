import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./schema/schema.graphqls",
  generates: {
    "./src/generated/schema-types.ts": {
      plugins: ["typescript"],
      config: {
        enumsAsTypes: true,
        nonOptionalTypename: true,
        skipTypename: false,
      },
    },
  },
};

export default config;
