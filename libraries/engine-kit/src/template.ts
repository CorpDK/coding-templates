import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./fs.js";

export type ResolveCanonicalOptions = {
  engineRoot: string;
  monorepoPath: string;
  bundledPath: string;
};

export async function resolveCanonical(
  options: ResolveCanonicalOptions,
): Promise<string> {
  const { monorepoPath, bundledPath } = options;
  const { pathExists } = await import("./fs.js");
  if (await pathExists(path.join(monorepoPath, "package.json"))) {
    return monorepoPath;
  }
  if (await pathExists(path.join(bundledPath, "package.json"))) {
    return bundledPath;
  }
  throw new Error(
    "Canonical template not found (expected monorepo path or bundled canonical/)",
  );
}

export function engineRootFromImportMeta(metaUrl: string): string {
  const dir = path.dirname(fileURLToPath(metaUrl));
  return path.resolve(dir, "..");
}

export async function readEngineRelease(
  engineRoot: string,
): Promise<string> {
  const pkg = await readJson<{ version?: string }>(
    path.join(engineRoot, "package.json"),
  );
  if (!pkg.version) {
    throw new Error(`package.json missing version under ${engineRoot}`);
  }
  return pkg.version;
}

export function initialCalVer(asOf: Date = new Date()): string {
  const year = asOf.getUTCFullYear();
  const month = asOf.getUTCMonth() + 1;
  return `${year}.${month}.0`;
}

export function isBundledCanonical(
  templateDir: string,
  bundledPath: string,
): boolean {
  return path.resolve(templateDir) === path.resolve(bundledPath);
}