#!/usr/bin/env node
import { runCli } from "@corpdk/graphql-cli-core";
import { buildQuery, buildMutation, buildSubscription } from "@corpdk/ds-sdk";
import * as validation from "@corpdk/ds-sdk/validation";
import { catalog } from "./generated/commands.js";
import { runtimeConfig } from "./generated/runtime-config.js";
import * as extensions from "./extensions/index.js";

process.exitCode = await runCli({
  catalog,
  config: runtimeConfig,
  sdk: { buildQuery, buildMutation, buildSubscription, validation },
  extensions,
  packageVersion: process.env.npm_package_version,
});
