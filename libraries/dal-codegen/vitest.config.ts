import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const dbStub = join(packageRoot, "src/__tests__/support/codegen-db-stub.ts");
const dbSchemaStub = join(packageRoot, "src/__tests__/support/codegen-db-schema-stub.ts");

function codegenDbStubPlugin(): Plugin {
  return {
    name: "codegen-db-stub",
    resolveId(source) {
      if (source.endsWith("/db/index.js") || source === "../../../db/index.js") {
        return dbStub;
      }
      if (source.endsWith("/db/schema/index.js") || source === "../../../db/schema/index.js") {
        return dbSchemaStub;
      }
      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [codegenDbStubPlugin()],
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/__tests__/**"],
    },
  },
});
