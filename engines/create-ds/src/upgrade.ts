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
  type EngineResult,
  EXIT_SUCCESS,
  EXIT_TOOL,
  EXIT_USAGE,
} from "@corpdk/engine-kit";
import { exitCodeForEngineError } from "./engine-errors.js";
import { execAsync } from "./exec.js";
import {
  CORP_DK_OWNED,
  CREATE_DS_ENGINE_ROOT,
  normalizeDalScripts,
  UPGRADE_MERGE_FILES,
  UPGRADE_RELATIVE_FILES,
} from "./constants.js";
import {
  isBundledCanonicalTemplate,
  readCreateDsReleaseVersion,
  resolveCanonicalDsTemplateDir,
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
  const consumer = await readJson<Parameters<typeof mergePackageJson>[0]>(destPath);
  const template =
    await readJson<Parameters<typeof mergePackageJson>[1]>(templatePath);
  await writeJson(
    destPath,
    mergePackageJson(consumer, template, {
      owned: CORP_DK_OWNED,
      scriptsTransform: normalizeDalScripts,
      releaseVersion,
    }),
  );
}

async function mergeUpgradeDalConfig(
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

async function runEntityLintIfAvailable(
  repoRoot: string,
  packageDir: string,
): Promise<void> {
  const dalCodegenLint = path.join(
    repoRoot,
    "libraries/dal-codegen/dist/lint-cli.js",
  );
  const localEntityLint = path.join(
    packageDir,
    "node_modules/.bin/dal-entity-lint",
  );
  const canRunEntityLint =
    (await pathExists(dalCodegenLint)) || (await pathExists(localEntityLint));

  if (!canRunEntityLint) return;

  const s = spinner();
  s.start("Running entity:lint");
  try {
    if (await pathExists(dalCodegenLint)) {
      await execAsync(`node "${dalCodegenLint}"`, { cwd: packageDir });
    } else {
      await execAsync("pnpm exec dal-entity-lint", { cwd: packageDir });
    }
    s.stop("entity:lint passed");
  } catch (err: unknown) {
    s.stop("entity:lint reported issues (see output above)");
    if (err instanceof Error && "stderr" in err) {
      console.error(String((err as { stderr?: string }).stderr ?? err.message));
    }
    throw err;
  }
}

export async function runUpgrade(options: UpgradeOptions): Promise<EngineResult> {
  const repoRoot =
    options.repoRoot ?? path.resolve(CREATE_DS_ENGINE_ROOT, "..", "..");
  const packageDir = path.resolve(options.dir);

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

  if (!(await pathExists(path.join(packageDir, "dal/dal.config.yaml")))) {
    return {
      exitCode: EXIT_USAGE,
      changedFiles: [],
      message: `Missing dal/dal.config.yaml under ${packageDir}`,
    };
  }

  if (!(await pathExists(templateDir))) {
    return {
      exitCode: EXIT_USAGE,
      changedFiles: [],
      message: `Canonical DS template not found (looked under ${templateDir}).`,
    };
  }

  const s = spinner();
  s.start("Merging automation stack from canonical template");

  const releaseVersion = isBundledCanonicalTemplate(templateDir)
    ? await readCreateDsReleaseVersion()
    : undefined;

  let changedFiles: string[] = [];

  try {
    const plan = await runUpgradePlan({
      overwrite: UPGRADE_RELATIVE_FILES,
      merge: [...UPGRADE_MERGE_FILES],
      templateDir,
      packageDir,
      dryRun: options.dryRun,
      mergeFile: async (rel, templatePath, destPath) => {
        if (rel === "package.json") {
          await mergeUpgradePackageJson(templatePath, destPath, releaseVersion);
          return;
        }
        if (rel === "dal/dal.config.yaml") {
          await mergeUpgradeDalConfig(templatePath, destPath);
        }
      },
      afterWrite: options.dryRun
        ? undefined
        : async () => {
            await runEntityLintIfAvailable(repoRoot, packageDir);
          },
    });

    changedFiles = plan.changedFiles;
    const version = await readCreateDsReleaseVersion();
    const versionRel = await writeEngineVersion(
      "create-ds",
      packageDir,
      version,
      options.dryRun,
    );
    changedFiles.push(versionRel);
  } catch (err: unknown) {
    s.stop("Upgrade failed after writing some files");
    return {
      exitCode: exitCodeForEngineError(err),
      changedFiles,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  s.stop("Template deltas merged (src/db/schema/** untouched)");

  return {
    exitCode: EXIT_SUCCESS,
    changedFiles,
    nextSteps: ["pnpm install", "pnpm dal:codegen"],
  };
}