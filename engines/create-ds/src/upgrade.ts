import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { spinner } from "@clack/prompts";
import {
  UPGRADE_RELATIVE_FILES,
  resolveCanonicalDsTemplateDir,
  isBundledCanonicalTemplate,
  readCreateDsReleaseVersion,
  isProtectedRelativePath,
} from "./template.js";
import {
  execAsync,
  pathExists,
  readJson,
  writeJson,
} from "./utils.js";
import {
  mergePackageJson,
  type MergePackageJsonOptions,
} from "./package-merge.js";

export interface UpgradeOptions {
  packageDir: string;
  repoRoot: string;
}

function mergeDalConfig(templateRaw: string, consumerRaw: string | null): string {
  const template = (parseYaml(templateRaw) as Record<string, unknown>) ?? {};
  const consumer = consumerRaw
    ? ((parseYaml(consumerRaw) as Record<string, unknown>) ?? {})
    : {};
  return stringifyYaml({ ...template, ...consumer });
}

async function mergeUpgradePackageJson(
  templatePath: string,
  destPath: string,
  mergeOptions: MergePackageJsonOptions | undefined,
): Promise<void> {
  const consumer = await readJson<Parameters<typeof mergePackageJson>[0]>(
    destPath,
  );
  const template = await readJson<Parameters<typeof mergePackageJson>[1]>(
    templatePath,
  );
  await writeJson(destPath, mergePackageJson(consumer, template, mergeOptions));
}

async function mergeUpgradeDalConfig(
  templatePath: string,
  destPath: string,
): Promise<void> {
  const templateRaw = await fs.readFile(templatePath, "utf8");
  const consumerRaw = (await pathExists(destPath))
    ? await fs.readFile(destPath, "utf8")
    : null;
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(
    destPath,
    mergeDalConfig(templateRaw, consumerRaw),
    "utf8",
  );
}

async function copyUpgradeRelativeFile(
  rel: string,
  templateDir: string,
  packageDir: string,
  mergeOptions: MergePackageJsonOptions | undefined,
): Promise<void> {
  const templatePath = path.join(templateDir, rel);
  const destPath = path.join(packageDir, rel);

  if (!(await pathExists(templatePath))) return;

  if (rel === "package.json") {
    await mergeUpgradePackageJson(templatePath, destPath, mergeOptions);
    return;
  }

  if (rel === "dal/dal.config.yaml") {
    await mergeUpgradeDalConfig(templatePath, destPath);
    return;
  }

  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.copyFile(templatePath, destPath);
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

export async function runUpgrade(options: UpgradeOptions): Promise<void> {
  const s = spinner();
  const packageDir = path.resolve(options.packageDir);
  const templateDir = await resolveCanonicalDsTemplateDir(options.repoRoot);

  if (!(await pathExists(path.join(packageDir, "dal/dal.config.yaml")))) {
    throw new Error(
      `Not a DAL DS package (missing dal/dal.config.yaml): ${packageDir}`,
    );
  }

  if (!(await pathExists(templateDir))) {
    throw new Error(`Canonical DS template not found: ${templateDir}`);
  }

  s.start("Merging automation stack from canonical template");

  const mergeOptions = isBundledCanonicalTemplate(templateDir)
    ? { publishedCorpdkVersions: await readCreateDsReleaseVersion() }
    : undefined;

  for (const rel of UPGRADE_RELATIVE_FILES) {
    if (isProtectedRelativePath(rel)) continue;
    await copyUpgradeRelativeFile(rel, templateDir, packageDir, mergeOptions);
  }

  s.stop("Template deltas merged (src/db/schema/** untouched)");

  await runEntityLintIfAvailable(options.repoRoot, packageDir);
}
