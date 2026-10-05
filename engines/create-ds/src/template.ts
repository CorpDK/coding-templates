import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root (engines/create-ds/dist → engines/create-ds → engines → root). */
export function repoRootFromEngine(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

export async function resolveCanonicalDsTemplateDir(
  repoRoot: string,
): Promise<string> {
  const monorepoTemplate = path.join(repoRoot, "templates", "ds");
  const bundled = path.resolve(__dirname, "..", "canonical");
  const { pathExists } = await import("./utils.js");
  if (await pathExists(path.join(monorepoTemplate, "package.json"))) {
    return monorepoTemplate;
  }
  if (await pathExists(path.join(bundled, "package.json"))) {
    return bundled;
  }
  throw new Error(
    "Canonical DS template not found (expected templates/ds or bundled canonical/)",
  );
}

export function engineStarterDir(): string {
  return path.resolve(__dirname, "..", "starter");
}

export function isBundledCanonicalTemplate(templateDir: string): boolean {
  const bundled = path.resolve(__dirname, "..", "canonical");
  return path.resolve(templateDir) === bundled;
}

export async function readCreateDsReleaseVersion(): Promise<string> {
  const { readJson } = await import("./utils.js");
  const pkg = await readJson<{ version: string }>(
    path.resolve(__dirname, "..", "package.json"),
  );
  if (!pkg.version) {
    throw new Error("create-ds package.json missing version");
  }
  return pkg.version;
}

/**
 * Initial CalVer for a newly scaffolded deployable DS package (`YYYY.MM.MICRO`, UTC).
 * Uses MICRO `0` for the first version in the scaffold month (Limitless CalVer policy).
 */
export function initialScaffoldCalVer(asOf: Date = new Date()): string {
  const year = asOf.getUTCFullYear();
  const month = asOf.getUTCMonth() + 1;
  return `${year}.${month}.0`;
}

/** Relative paths under templates/ds merged on upgrade (never touches src/db/schema/**). */
export const UPGRADE_RELATIVE_FILES = [
  "package.json",
  "dal/dal.config.yaml",
  "codegen.ts",
  "drizzle.config.ts",
  "tsconfig.json",
  "Dockerfile",
  "docker-compose.yml",
  "docker-entrypoint.sh",
  ".gitignore",
  ".env.example",
  "src/schema.ts",
  "src/index.ts",
  "src/db/index.ts",
] as const;

export const PROTECTED_PREFIXES = ["src/db/schema/"] as const;

export function isProtectedRelativePath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  return PROTECTED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
