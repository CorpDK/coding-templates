#!/usr/bin/env node
import { resolve } from "node:path";
import { runDalCodegen } from "./generate.js";
import type { CodegenOptions, DalCodegenMode } from "./config.js";

function parseMode(argv: string[]): DalCodegenMode {
  const flag = argv.find((a) => a.startsWith("--mode="));
  if (flag) {
    const value = flag.slice("--mode=".length);
    if (
      value === "schema" ||
      value === "impl" ||
      value === "all" ||
      value === "bootstrap"
    ) {
      return value;
    }
    throw new Error(
      `Invalid --mode=${value} (expected schema | impl | all | bootstrap)`,
    );
  }
  const envMode = process.env.DAL_CODEGEN_MODE;
  if (
    envMode === "schema" ||
    envMode === "impl" ||
    envMode === "all" ||
    envMode === "bootstrap"
  ) {
    return envMode;
  }
  return "all";
}

const packageRoot = resolve(process.cwd());

const options: CodegenOptions = {
  packageRoot,
  schemaPath: process.env.DAL_SCHEMA_PATH ?? "src/db/schema",
  outputDir: process.env.DAL_OUTPUT_DIR ?? "src/generated/dal",
  schemaOutputPath:
    process.env.DAL_SCHEMA_OUTPUT_PATH ?? "src/generated/generated-schema.ts",
  entityRecordsOutputPath:
    process.env.DAL_ENTITY_RECORDS_PATH ?? "src/generated/entity-records.ts",
  mappersOutputPath:
    process.env.DAL_MAPPERS_OUTPUT_PATH ?? "src/generated/graphql-codegen.mappers.ts",
  configPath: process.env.DAL_CONFIG_PATH ?? "dal/dal.config.yaml",
  mode: parseMode(process.argv.slice(2)),
};

try {
  await runDalCodegen(options);
} catch (err) {
  console.error("dal-codegen failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
