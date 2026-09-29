#!/usr/bin/env node
import { resolve } from "node:path";
import { runDalCodegen } from "./generate.js";

const packageRoot = resolve(process.cwd());
const schemaPath = process.env.DAL_SCHEMA_PATH ?? "src/db/schema";
const outputDir = process.env.DAL_OUTPUT_DIR ?? "src/generated/dal";
const schemaOutputPath =
  process.env.DAL_SCHEMA_OUTPUT_PATH ?? "src/generated/generated-schema.ts";
const configPath = process.env.DAL_CONFIG_PATH ?? "dal/dal.config.yaml";

try {
  await runDalCodegen({ packageRoot, schemaPath, outputDir, schemaOutputPath, configPath });
} catch (err) {
  console.error("dal-codegen failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
