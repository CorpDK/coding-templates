import path from "node:path";
import { readJson } from "@corpdk/engine-kit";
import { outro } from "@clack/prompts";
import type { ParsedCli } from "./args.js";
import { CREATE_GRAPHQL_SDK_ENGINE_ROOT } from "./constants.js";
import {
  runCodegenCommand,
  runGenerate,
  runSync,
} from "./commands.js";
import { runInit } from "./init.js";
import { runUpgrade } from "./upgrade.js";

export async function handleVersion(): Promise<number> {
  try {
    const pkg = await readJson<{ version: string }>(
      path.join(CREATE_GRAPHQL_SDK_ENGINE_ROOT, "package.json"),
    );
    console.log(pkg.version);
    return 0;
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : err);
    return 1;
  }
}

function printError(result: { message?: string; exitCode: number }): void {
  if (result.message && result.exitCode !== 0) {
    console.error(result.message);
  }
}

export async function handleInit(
  parsed: Extract<ParsedCli, { kind: "init" }>,
  repoRoot: string,
): Promise<number> {
  const schema = parsed.schema.map((p) =>
    path.isAbsolute(p) ? p : path.resolve(process.cwd(), p),
  );
  const result = await runInit({
    dir: parsed.dir,
    name: parsed.name,
    schema,
    demoSchema: parsed.demoSchema,
    scalarPreset: parsed.scalarPreset,
    deferSync: parsed.deferSync,
    dryRun: parsed.dryRun,
    noInstall: parsed.noInstall,
    repoRoot,
  });
  printError(result);
  if (result.exitCode === 0) {
    const steps = result.nextSteps?.length
      ? result.nextSteps.join("\n  ")
      : `cd ${parsed.dir}\n  pnpm install\n  pnpm sdk:codegen`;
    outro(`SDK package ready at:\n  ${parsed.dir}\n\nNext steps:\n  ${steps}`);
  }
  return result.exitCode;
}

export async function handleSync(
  parsed: Extract<ParsedCli, { kind: "sync" }>,
): Promise<number> {
  const result = await runSync({
    dir: parsed.dir,
    check: parsed.check,
    failOnBreaking: parsed.failOnBreaking,
  });
  printError(result);
  return result.exitCode;
}

export async function handleCodegen(
  parsed: Extract<ParsedCli, { kind: "codegen" }>,
): Promise<number> {
  const result = await runCodegenCommand(parsed.dir);
  printError(result);
  return result.exitCode;
}

export async function handleGenerate(
  parsed: Extract<ParsedCli, { kind: "generate" }>,
): Promise<number> {
  const result = await runGenerate({
    dir: parsed.dir,
    check: parsed.check,
    failOnBreaking: parsed.failOnBreaking,
  });
  printError(result);
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
  printError(result);
  if (result.exitCode === 0) {
    const steps =
      result.nextSteps?.join("\n  ") ?? "pnpm install\n  pnpm sdk:codegen\n  pnpm build";
    outro(`Upgrade complete for:\n  ${parsed.dir}\n\nNext steps:\n  ${steps}`);
  }
  return result.exitCode;
}