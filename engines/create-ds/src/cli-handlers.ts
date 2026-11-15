import { readJson } from "@corpdk/engine-kit";
import { outro } from "@clack/prompts";
import path from "node:path";
import type { ParsedCli } from "./args.js";
import { CREATE_DS_ENGINE_ROOT } from "./constants.js";
import { runInit } from "./init.js";
import { runUpgrade } from "./upgrade.js";

export async function handleVersion(): Promise<number> {
  try {
    const pkg = await readJson<{ version: string }>(
      path.join(CREATE_DS_ENGINE_ROOT, "package.json"),
    );
    console.log(pkg.version);
    return 0;
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : err);
    return 1;
  }
}

export async function handleInit(
  parsed: Extract<ParsedCli, { kind: "init" }>,
  repoRoot: string,
): Promise<number> {
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

export async function handleUpgrade(
  parsed: Extract<ParsedCli, { kind: "upgrade" }>,
  repoRoot: string,
): Promise<number> {
  const result = await runUpgrade({
    dir: parsed.dir,
    dryRun: parsed.dryRun,
    repoRoot,
  });

  if (result.message && result.exitCode !== 0) {
    console.error(result.message);
  }
  if (result.exitCode === 0) {
    const steps =
      result.nextSteps?.join("\n  ") ?? "pnpm install\n  pnpm dal:codegen";
    outro(`Upgrade complete for:\n  ${parsed.dir}\n\nNext steps:\n  ${steps}`);
  }

  return result.exitCode;
}
