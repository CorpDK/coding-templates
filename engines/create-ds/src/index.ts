#!/usr/bin/env node
import { readJson } from "@corpdk/engine-kit";
import { outro } from "@clack/prompts";
import path from "node:path";
import { CREATE_DS_HELP, parseCli, printHelp } from "./args.js";
import { CREATE_DS_ENGINE_ROOT } from "./constants.js";
import { runInit } from "./init.js";
import { runUpgrade } from "./upgrade.js";
import { repoRootFromEngine } from "./template.js";

async function main(): Promise<number> {
  const parsed = parseCli(process.argv);

  if (parsed.kind === "help") {
    printHelp();
    return 0;
  }

  if (parsed.kind === "version") {
    const pkg = await readJson<{ version: string }>(
      path.join(CREATE_DS_ENGINE_ROOT, "package.json"),
    );
    console.log(pkg.version);
    return 0;
  }

  if (parsed.kind === "usage") {
    console.error(parsed.message);
    console.error(CREATE_DS_HELP);
    return 2;
  }

  const repoRoot = repoRootFromEngine();

  if (parsed.kind === "init") {
    const result = await runInit({
      dir: parsed.dir,
      name: parsed.name,
      demoSchema: parsed.demoSchema,
      dryRun: parsed.dryRun,
      noInstall: parsed.noInstall,
      repoRoot,
    });
    if (result.message && result.exitCode !== 0) {
      console.error(result.message);
    }
    if (result.exitCode === 0) {
      const steps = result.nextSteps?.length
        ? result.nextSteps.join("\n  ")
        : `cd ${parsed.dir}\n  pnpm install\n  pnpm dal:codegen`;
      outro(`DS package ready at:\n  ${parsed.dir}\n\nNext steps:\n  ${steps}`);
    }
    return result.exitCode;
  }

  const result = await runUpgrade({
    dir: parsed.dir,
    dryRun: parsed.dryRun,
    repoRoot,
  });

  if (result.message && result.exitCode !== 0) {
    console.error(result.message);
  }
  if (result.exitCode === 0) {
    const steps = result.nextSteps?.join("\n  ") ?? "pnpm install\n  pnpm dal:codegen";
    outro(`Upgrade complete for:\n  ${parsed.dir}\n\nNext steps:\n  ${steps}`);
  }

  return result.exitCode;
}

const code = await main();
process.exit(code);