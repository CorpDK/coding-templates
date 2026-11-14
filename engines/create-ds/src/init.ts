import path from "node:path";
import {
  pathExists,
  type EngineResult,
  EXIT_SUCCESS,
  EXIT_TOOL,
  EXIT_USAGE,
} from "@corpdk/engine-kit";
import { exitCodeForEngineError } from "./engine-errors.js";
import { spinner } from "@clack/prompts";
import {
  CREATE_DS_ENGINE_ROOT,
} from "./constants.js";
import {
  resolveCanonicalDsTemplateDir,
} from "./template.js";
import {
  applyScaffoldLayout,
  ensureEmptyTarget,
} from "./init-layout.js";

export interface InitOptions {
  dir: string;
  name: string;
  demoSchema?: boolean;
  noInstall?: boolean;
  dryRun?: boolean;
  repoRoot?: string;
}

function initNextSteps(packageName: string, noInstall?: boolean): string[] {
  const steps: string[] = [];
  if (!noInstall) steps.push("pnpm install");
  steps.push(`pnpm --filter ${packageName} dal:codegen`);
  return steps;
}

export async function runInit(options: InitOptions): Promise<EngineResult> {
  const repoRoot =
    options.repoRoot ?? path.resolve(CREATE_DS_ENGINE_ROOT, "..", "..");
  const targetDir = path.resolve(options.dir);

  let templateDir: string;
  try {
    templateDir = await resolveCanonicalDsTemplateDir(repoRoot);
  } catch (err: unknown) {
    return {
      exitCode: EXIT_TOOL,
      changedFiles: [],
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (!(await pathExists(templateDir))) {
    return {
      exitCode: EXIT_USAGE,
      changedFiles: [],
      message: `Canonical DS template not found (looked under ${templateDir}).`,
    };
  }

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
  s.start("Scaffolding DS package layout");

  try {
    await applyScaffoldLayout(options, repoRoot, templateDir, targetDir);
    s.stop("DS package scaffolded");

    return {
      exitCode: EXIT_SUCCESS,
      changedFiles: [],
      nextSteps: initNextSteps(options.name, options.noInstall),
    };
  } catch (err: unknown) {
    s.stop("Scaffold failed");
    return {
      exitCode: exitCodeForEngineError(err),
      changedFiles: [],
      message: err instanceof Error ? err.message : String(err),
    };
  }
}