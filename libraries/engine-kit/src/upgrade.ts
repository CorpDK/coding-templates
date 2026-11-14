import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./fs.js";

export type UpgradeMergeHandler = (
  rel: string,
  templatePath: string,
  destPath: string,
) => Promise<void>;

export type RunUpgradePlanOptions = {
  overwrite: readonly string[];
  merge: readonly string[];
  templateDir: string;
  packageDir: string;
  dryRun?: boolean;
  mergeFile?: UpgradeMergeHandler;
  afterWrite?: () => Promise<void>;
};

export type UpgradePlanResult = {
  changedFiles: string[];
};

export async function runUpgradePlan(
  options: RunUpgradePlanOptions,
): Promise<UpgradePlanResult> {
  const changedFiles: string[] = [];
  const dryRun = options.dryRun ?? false;
  const mergeSet = new Set(options.merge);

  for (const rel of options.overwrite) {
    const templatePath = path.join(options.templateDir, rel);
    const destPath = path.join(options.packageDir, rel);

    if (!(await pathExists(templatePath))) continue;

    changedFiles.push(rel);

    if (dryRun) continue;

    if (mergeSet.has(rel) && options.mergeFile) {
      await options.mergeFile(rel, templatePath, destPath);
      continue;
    }

    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(templatePath, destPath);
  }

  if (!dryRun && options.afterWrite) {
    await options.afterWrite();
  }

  return { changedFiles };
}

export async function writeEngineVersion(
  engineName: string,
  packageDir: string,
  version: string,
  dryRun?: boolean,
): Promise<string> {
  const rel = `.${engineName}-version`;
  const dest = path.join(packageDir, rel);
  if (!dryRun) {
    await fs.writeFile(dest, `${version}\n`, "utf8");
  }
  return rel;
}
