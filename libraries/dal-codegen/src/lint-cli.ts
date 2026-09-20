#!/usr/bin/env node
import { resolve } from "node:path";
import {
  formatLintViolations,
  lintExitCode,
  runEntityLint,
} from "./entity-lint.js";

const packageRoot = resolve(process.cwd());
const schemaPath = process.env.DAL_SCHEMA_PATH ?? "src/db/schema";
const configPath = process.env.DAL_CONFIG_PATH ?? "dal/dal.config.yaml";

runEntityLint({ packageRoot, schemaPath, configPath })
  .then((result) => {
    const output = formatLintViolations(result.violations);
    if (result.violations.length > 0) {
      console.error(output);
    } else {
      console.log(output);
    }
    console.log(`entity:lint — checked ${result.entityCount} entity table(s)`);
    process.exit(lintExitCode(result.violations));
  })
  .catch((err) => {
    console.error("entity:lint failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
