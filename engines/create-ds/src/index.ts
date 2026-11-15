#!/usr/bin/env node
import { CREATE_DS_HELP, parseCli, printHelp } from "./args.js";
import { handleInit, handleUpgrade, handleVersion } from "./cli-handlers.js";
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
    console.error(CREATE_DS_HELP);
    return 2;
  }

  const repoRoot = repoRootFromEngine();

  if (parsed.kind === "init") {
    return handleInit(parsed, repoRoot);
  }

  return handleUpgrade(parsed, repoRoot);
}

const code = await main();
process.exit(code);
