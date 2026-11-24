import path from "node:path";
import { spinner } from "@clack/prompts";
import {
  EXIT_SUCCESS,
  EXIT_TOOL,
  EXIT_USAGE,
  EXIT_VALIDATION,
  pathExists,
  type EngineResult,
} from "@corpdk/engine-kit";
import { exitCodeForEngineError } from "./engine-errors.js";
import { execAsync } from "./exec.js";
import { CREATE_GRAPHQL_SDK_ENGINE_ROOT } from "./constants.js";
import { applyScaffoldLayout, ensureEmptyTarget } from "./init-layout.js";
import { formatUnmappedMessage, runSyncPipeline } from "./sync.js";
import { resolveCanonicalSdkTemplateDir } from "./template.js";

export interface InitOptions {
  dir: string;
  name: string;
  schema: string[];
  scalarPreset?: "dal";
  deferSync?: boolean;
  noInstall?: boolean;
  demoSchema?: boolean;
  dryRun?: boolean;
  repoRoot?: string;
}

function initNextSteps(packageName: string, noInstall?: boolean): string[] {
  const steps: string[] = [];
  if (!noInstall) steps.push("pnpm install");
  steps.push(
    `pnpm --filter ${packageName} sdk:codegen`,
    `pnpm --filter ${packageName} build`,
  );
  return steps;
}

async function resolveInitTemplateDir(repoRoot: string): Promise<
  { ok: true; templateDir: string } | { ok: false; result: EngineResult }
> {
  try {
    const templateDir = await resolveCanonicalSdkTemplateDir(repoRoot);
    if (!(await pathExists(templateDir))) {
      return {
        ok: false,
        result: {
          exitCode: EXIT_USAGE,
          changedFiles: [],
          message: `Canonical SDK template not found (looked under ${templateDir}).`,
        },
      };
    }
    return { ok: true, templateDir };
  } catch (err: unknown) {
    return {
      ok: false,
      result: {
        exitCode: EXIT_TOOL,
        changedFiles: [],
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function installDependencies(repoRoot: string): Promise<EngineResult | null> {
  const install = spinner();
  install.start("Installing dependencies");
  try {
    await execAsync("pnpm install", { cwd: repoRoot });
    install.stop("Dependencies installed");
    return null;
  } catch (err: unknown) {
    install.stop("pnpm install failed");
    return {
      exitCode: EXIT_TOOL,
      changedFiles: [],
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runInitCodegen(targetDir: string): Promise<EngineResult> {
  const codegenSpinner = spinner();
  codegenSpinner.start("Running SDK codegen");
  try {
    const { runCodegen } = await import("./codegen.js");
    const files = await runCodegen(targetDir);
    codegenSpinner.stop("Codegen complete");
    return { exitCode: EXIT_SUCCESS, changedFiles: files };
  } catch (err: unknown) {
    codegenSpinner.stop("Codegen failed");
    return {
      exitCode: EXIT_TOOL,
      changedFiles: [],
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function syncAfterScaffold(targetDir: string): Promise<EngineResult | null> {
  const sync = await runSyncPipeline({ packageDir: targetDir, writeStubs: true });
  if (sync.unmappedScalars.length === 0) return null;
  return {
    exitCode: EXIT_VALIDATION,
    changedFiles: [sync.snapshotRel],
    message: formatUnmappedMessage(sync.unmappedScalars),
    nextSteps: [
      "Review stub scalar entries in sdk.config.yaml, then re-run sdk:sync",
    ],
  };
}

function missingSchemaUsage(): EngineResult {
  return {
    exitCode: EXIT_USAGE,
    changedFiles: [],
    message: "init requires --schema, or use --demo-schema",
  };
}

function deferSyncResult(options: InitOptions): EngineResult {
  return {
    exitCode: EXIT_SUCCESS,
    changedFiles: [],
    nextSteps: [
      ...(options.noInstall ? [] : ["pnpm install"]),
      `pnpm --filter ${options.name} sdk:sync`,
      `pnpm --filter ${options.name} sdk:codegen`,
    ],
  };
}

async function finalizeScaffoldedPackage(
  options: InitOptions,
  repoRoot: string,
  targetDir: string,
): Promise<EngineResult> {
  const syncError = await syncAfterScaffold(targetDir);
  if (syncError) return syncError;

  if (!options.noInstall) {
    const installError = await installDependencies(repoRoot);
    if (installError) return installError;
  }

  const codegen = await runInitCodegen(targetDir);
  if (codegen.exitCode !== EXIT_SUCCESS) return codegen;
  return {
    ...codegen,
    nextSteps: initNextSteps(options.name, options.noInstall),
  };
}

async function runInitAfterScaffold(
  options: InitOptions,
  repoRoot: string,
  targetDir: string,
): Promise<EngineResult> {
  if (options.deferSync) return deferSyncResult(options);
  return finalizeScaffoldedPackage(options, repoRoot, targetDir);
}

export async function runInit(options: InitOptions): Promise<EngineResult> {
  const repoRoot =
    options.repoRoot ??
    path.resolve(CREATE_GRAPHQL_SDK_ENGINE_ROOT, "..", "..");
  const targetDir = path.resolve(options.dir);

  if (!options.demoSchema && options.schema.length === 0) {
    return missingSchemaUsage();
  }

  const template = await resolveInitTemplateDir(repoRoot);
  if (!template.ok) return template.result;

  const emptyError = await ensureEmptyTarget(targetDir);
  if (emptyError) {
    return {
      exitCode: EXIT_USAGE,
      changedFiles: [],
      message: emptyError,
    };
  }

  if (options.dryRun) {
    return {
      exitCode: EXIT_SUCCESS,
      changedFiles: ["<scaffold layout>"],
      nextSteps: initNextSteps(options.name, options.noInstall),
    };
  }

  const s = spinner();
  s.start("Scaffolding SDK package layout");

  try {
    await applyScaffoldLayout(options, repoRoot, template.templateDir, targetDir);
    s.stop("SDK package scaffolded");
    return runInitAfterScaffold(options, repoRoot, targetDir);
  } catch (err: unknown) {
    s.stop("Scaffold failed");
    return {
      exitCode: exitCodeForEngineError(err),
      changedFiles: [],
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
