#!/usr/bin/env node
import { CREATE_GRAPHQL_SDK_HELP, parseCli, printHelp } from "./args.js";
import {
  handleCodegen,
  handleGenerate,
  handleInit,
  handleSync,
  handleUpgrade,
  handleVersion,
} from "./cli-handlers.js";
import { repoRootFromEngine } from "./template.js";

async function main(): Promise<number> {
  const parsed = parseCli(process.argv);

  if (parsed.kind === "help") {
    printHelp();
    return 0;
  }

  if (parsed.kind === "version") {
    return handleVersion();
  }

  if (parsed.kind === "usage") {
    console.error(parsed.message);
    console.error(CREATE_GRAPHQL_SDK_HELP);
    return 2;
  }

  const repoRoot = repoRootFromEngine();

  switch (parsed.kind) {
    case "init":
      return handleInit(parsed, repoRoot);
    case "sync":
      return handleSync(parsed);
    case "codegen":
      return handleCodegen(parsed);
    case "generate":
      return handleGenerate(parsed);
    default:
      return handleUpgrade(parsed, repoRoot);
  }
}

const code = await main();
process.exit(code);
