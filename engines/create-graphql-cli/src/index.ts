#!/usr/bin/env node
import path from "node:path";
import {
  readEngineRelease,
  runEngineCli,
  type EngineCommandHandler,
} from "@corpdk/engine-kit";
import { CREATE_GRAPHQL_CLI_ENGINE_ROOT, CREATE_GRAPHQL_CLI_HELP } from "./constants.js";
import { runInit } from "./init.js";
import { runGenerate } from "./generate.js";
import { runUpgrade } from "./upgrade.js";
import { engineResult } from "./engine-result.js";

const initHandler: EngineCommandHandler = async (positional, values) => {
  const targetDir = path.resolve(positional[0] ?? ".");
  const sdk = values.sdk as string | undefined;
  const name = values.name as string | undefined;
  const bin = values.bin as string | undefined;
  if (!sdk || !name) {
    return engineResult({
      exitCode: 2,
      message: "init requires --sdk and --name",
    });
  }
  return runInit({
    targetDir,
    sdkPath: sdk,
    name,
    bin,
    noInstall: values["no-install"] === true,
    deferGenerate: values["defer-generate"] === true,
    dryRun: values["dry-run"] === true,
  });
};

const generateHandler: EngineCommandHandler = async (positional, values) => {
  const packageDir = path.resolve(positional[0] ?? ".");
  return runGenerate({
    packageDir,
    check: values.check === true,
  });
};

const upgradeHandler: EngineCommandHandler = async (positional, values) => {
  const packageDir = path.resolve(positional[0] ?? ".");
  return runUpgrade({
    packageDir,
    dryRun: values["dry-run"] === true,
  });
};

const version = await readEngineRelease(CREATE_GRAPHQL_CLI_ENGINE_ROOT);

const code = await runEngineCli({
  name: "create-graphql-cli",
  version,
  help: CREATE_GRAPHQL_CLI_HELP,
  commands: [
    {
      name: "init",
      handler: initHandler,
      options: {
        sdk: { type: "string" },
        name: { type: "string" },
        bin: { type: "string" },
        "no-install": { type: "boolean" },
        "defer-generate": { type: "boolean" },
        "dry-run": { type: "boolean" },
      },
    },
    {
      name: "generate",
      handler: generateHandler,
      options: {
        check: { type: "boolean" },
      },
    },
    {
      name: "upgrade",
      handler: upgradeHandler,
      options: {
        "dry-run": { type: "boolean" },
      },
    },
  ],
});

if (code !== 0) {
  console.error(`create-graphql-cli failed (exit ${code})`);
}
process.exit(code);