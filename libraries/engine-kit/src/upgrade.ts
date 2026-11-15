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
  /** When true (default), every overwrite path must exist under templateDir. */
  requireOverwriteSources?: boolean;
  mergeFile?: UpgradeMergeHandler;
  afterWrite?: () => Promise<void>;
};

export class MissingOverwriteSourceError extends Error {
  readonly relPath: string;
  readonly templatePath: string;

  constructor(relPath: string, templatePath: string) {
    super(
      `Canonical template file missing: ${relPath} (expected ${templatePath})`,
    );
    this.name = "MissingOverwriteSourceError";
    this.relPath = relPath;
    this.templatePath = templatePath;
  }
}

export type UpgradePlanResult = {
  changedFiles: string[];
};

export async function runUpgradePlan(
  options: RunUpgradePlanOptions,
): Promise<UpgradePlanResult> {
  const changedFiles: string[] = [];
  const dryRun = options.dryRun ?? false;
  const requireSources = options.requireOverwriteSources ?? true;
  const mergeSet = new Set(options.merge);

  const overwriteRows = await Promise.all(
    options.overwrite.map(async (rel) => {
      const templatePath = path.join(options.templateDir, rel);
      const destPath = path.join(options.packageDir, rel);
      const exists = await pathExists(templatePath);
      return { rel, templatePath, destPath, exists };
    }),
  );

  const toWrite: typeof overwriteRows = [];
  for (const row of overwriteRows) {
    if (!row.exists) {
      if (requireSources) {
        throw new MissingOverwriteSourceError(row.rel, row.templatePath);
      }
      continue;
    }
    changedFiles.push(row.rel);
    if (!dryRun) {
      toWrite.push(row);
    }
  }

  await Promise.all(
    toWrite.map(async (row) => {
      if (mergeSet.has(row.rel) && options.mergeFile) {
        await options.mergeFile(row.rel, row.templatePath, row.destPath);
        return;
      }
      await fs.mkdir(path.dirname(row.destPath), { recursive: true });
      await fs.copyFile(row.templatePath, row.destPath);
    }),
  );

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
