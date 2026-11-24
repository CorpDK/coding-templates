import path from "node:path";
import { spinner } from "@clack/prompts";
import {
  pathExists,
  runUpgradePlan,
  writeEngineVersion,
  EXIT_SUCCESS,
  EXIT_TOOL,
  EXIT_USAGE,
  type EngineResult,
} from "@corpdk/engine-kit";
import { exitCodeForEngineError } from "./engine-errors.js";
import {
  CREATE_GRAPHQL_SDK_ENGINE_ROOT,
  ENGINE_VERSION_BASENAME,
  UPGRADE_OVERWRITE_FILES,
} from "./constants.js";
import {
  readCreateGraphqlSdkReleaseVersion,
  resolveCanonicalSdkTemplateDir,
} from "./template.js";

export interface UpgradeOptions {
  dir: string;
  dryRun?: boolean;
  repoRoot?: string;
}

export async function runUpgrade(
  options: UpgradeOptions,
): Promise<EngineResult> {
  const repoRoot =
    options.repoRoot ??
    path.resolve(CREATE_GRAPHQL_SDK_ENGINE_ROOT, "..", "..");
  const packageDir = path.resolve(options.dir);

  let templateDir: string;
  try {
    templateDir = await resolveCanonicalSdkTemplateDir(repoRoot);
  } catch (err: unknown) {
    return {
      exitCode: EXIT_TOOL,
      changedFiles: [],
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (!(await pathExists(path.join(packageDir, "sdk.config.yaml")))) {
    return {
      exitCode: EXIT_USAGE,
      changedFiles: [],
      message: `Missing sdk.config.yaml under ${packageDir}`,
    };
  }

  const s = spinner();
  s.start("Merging canonical SDK template");

  let changedFiles: string[] = [];

  try {
    const plan = await runUpgradePlan({
      overwrite: [...UPGRADE_OVERWRITE_FILES],
      merge: [],
      templateDir,
      packageDir,
      dryRun: options.dryRun,
    });

    changedFiles = plan.changedFiles;
    const version = await readCreateGraphqlSdkReleaseVersion();
    const versionRel = await writeEngineVersion(
      ENGINE_VERSION_BASENAME,
      packageDir,
      version,
      options.dryRun,
    );
    changedFiles.push(versionRel);
  } catch (err: unknown) {
    s.stop("Upgrade failed");
    return {
      exitCode: exitCodeForEngineError(err),
      changedFiles,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  s.stop(
    "Canonical SDK files merged (schema/** and src/extensions/** untouched)",
  );

  if (!options.dryRun) {
    try {
      const { runCodegen } = await import("./codegen.js");
      const generated = await runCodegen(packageDir);
      changedFiles.push(...generated);
    } catch (err: unknown) {
      return {
        exitCode: EXIT_TOOL,
        changedFiles,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    exitCode: EXIT_SUCCESS,
    changedFiles,
    nextSteps: ["pnpm install", "pnpm sdk:codegen", "pnpm build"],
  };
}