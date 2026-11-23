import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { spinner } from "@clack/prompts";
import {
  mergePackageJson,
  mergeYamlConfig,
  pathExists,
  readJson,
  runUpgradePlan,
  writeEngineVersion,
  writeJson,
  EXIT_SUCCESS,
  EXIT_TOOL,
  EXIT_USAGE,
  type EngineResult,
} from "@corpdk/engine-kit";
import { exitCodeForEngineError } from "./engine-errors.js";
import {
  CORP_DK_OWNED,
  CREATE_GRAPHQL_SDK_ENGINE_ROOT,
  ENGINE_VERSION_BASENAME,
  UPGRADE_MERGE_FILES,
  UPGRADE_OVERWRITE_FILES,
} from "./constants.js";
import {
  isBundledCanonicalTemplate,
  readCreateGraphqlSdkReleaseVersion,
  resolveCanonicalSdkTemplateDir,
} from "./template.js";

export interface UpgradeOptions {
  dir: string;
  dryRun?: boolean;
  repoRoot?: string;
}

async function mergeUpgradePackageJson(
  templatePath: string,
  destPath: string,
  releaseVersion: string | undefined,
): Promise<void> {
  const consumer =
    await readJson<Parameters<typeof mergePackageJson>[0]>(destPath);
  const template =
    await readJson<Parameters<typeof mergePackageJson>[1]>(templatePath);
  await writeJson(
    destPath,
    mergePackageJson(consumer, template, {
      owned: CORP_DK_OWNED,
      releaseVersion,
    }),
  );
}

async function mergeUpgradeSdkConfig(
  templatePath: string,
  destPath: string,
): Promise<void> {
  const templateRaw = await fs.readFile(templatePath, "utf8");
  const consumerRaw = (await pathExists(destPath))
    ? await fs.readFile(destPath, "utf8")
    : null;
  const template = (parseYaml(templateRaw) as Record<string, unknown>) ?? {};
  const consumer = consumerRaw
    ? ((parseYaml(consumerRaw) as Record<string, unknown>) ?? {})
    : {};
  const merged = mergeYamlConfig(template, consumer);
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, stringifyYaml(merged), "utf8");
}

export async function runUpgrade(
  options: UpgradeOptions,
): Promise<EngineResult> {
  const repoRoot =
    options.repoRoot ?? path.resolve(CREATE_GRAPHQL_SDK_ENGINE_ROOT, "..", "..");
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

  const releaseVersion = isBundledCanonicalTemplate(templateDir)
    ? await readCreateGraphqlSdkReleaseVersion()
    : undefined;

  let changedFiles: string[] = [];

  try {
    const plan = await runUpgradePlan({
      overwrite: [...UPGRADE_OVERWRITE_FILES],
      merge: [...UPGRADE_MERGE_FILES],
      templateDir,
      packageDir,
      dryRun: options.dryRun,
      mergeFile: async (rel, templatePath, destPath) => {
        if (rel === "package.json") {
          await mergeUpgradePackageJson(templatePath, destPath, releaseVersion);
          return;
        }
        if (rel === "sdk.config.yaml") {
          await mergeUpgradeSdkConfig(templatePath, destPath);
        }
      },
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

  s.stop("Canonical SDK files merged (schema/** and src/extensions/** untouched)");

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