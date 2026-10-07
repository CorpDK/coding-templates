import fs from "node:fs/promises";
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

/** Health, observability, and validation modules referenced by bootstrap entry files. */
export const BOOTSTRAP_STATIC_SRC_RELATIVE = [
  "src/health.ts",
  "src/validation/parse-input.ts",
  "src/observability/otel-config.ts",
  "src/observability/otel-smoke-extensions.ts",
  "src/observability/preload-otel.ts",
  "src/observability/yoga-tracing-plugin.ts",
] as const;

export async function copyBootstrapStaticSrc(
  templateDir: string,
  packageDir: string,
): Promise<void> {
  const { pathExists } = await import("./utils.js");
  for (const rel of BOOTSTRAP_STATIC_SRC_RELATIVE) {
    const templatePath = path.join(templateDir, rel);
    if (!(await pathExists(templatePath))) continue;
    const destPath = path.join(packageDir, rel);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(templatePath, destPath);
  }
}

/** Relative paths under templates/ds merged on upgrade (never touches src/db/schema/**). */
export const UPGRADE_RELATIVE_FILES = [
  "LICENSE",
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
  ...BOOTSTRAP_STATIC_SRC_RELATIVE,
] as const;
