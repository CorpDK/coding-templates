import { engineRootFromImportMeta, initialCalVer } from "@corpdk/engine-kit";

export const CREATE_DS_ENGINE_ROOT = engineRootFromImportMeta(import.meta.url);

export const CORP_DK_OWNED = new Set([
  "@corpdk/dal-core",
  "@corpdk/pub-sub",
  "@corpdk/codegen-cli",
  "@corpdk/dal-codegen",
]);

export const COPY_TEMPLATE_EXCLUDE = [
  "node_modules",
  ".turbo",
  "dist",
  ".next",
  "generated",
  "drizzle",
  "src",
  "*.tsbuildinfo",
  ".env",
] as const;

export const DAL_CODEGEN_CLI = "node ./node_modules/@corpdk/dal-codegen/dist/cli.js";
export const DAL_ENTITY_LINT_CLI =
  "node ./node_modules/@corpdk/dal-codegen/dist/lint-cli.js";

export function normalizeDalScripts(
  scripts: Record<string, string>,
): Record<string, string> {
  const out = { ...scripts };
  out["dal:codegen:schema"] = `${DAL_CODEGEN_CLI} --mode=schema`;
  out["dal:codegen:impl"] = `${DAL_CODEGEN_CLI} --mode=impl`;
  out["dal:codegen:bootstrap"] = `${DAL_CODEGEN_CLI} --mode=bootstrap`;
  out["entity:lint"] = DAL_ENTITY_LINT_CLI;
  return out;
}

export { initialCalVer as initialScaffoldCalVer };

export const BOOTSTRAP_STATIC_SRC_RELATIVE = [
  "src/health.ts",
  "src/validation/parse-input.ts",
  "src/observability/otel-config.ts",
  "src/observability/otel-smoke-extensions.ts",
  "src/observability/preload-otel.ts",
  "src/observability/yoga-tracing-plugin.ts",
] as const;

export const UPGRADE_RELATIVE_FILES = [
  "LICENSE",
  "package.json",
  "dal/dal.config.yaml",
  "codegen.ts",
  "drizzle.config.ts",
  "tsconfig.json",
  "Dockerfile",
  "docker-compose.yml",
  "docker/otel-collector-config.yaml",
  "docker-entrypoint.sh",
  ".gitignore",
  ".env.example",
  "src/schema.ts",
  "src/index.ts",
  "src/db/index.ts",
  ...BOOTSTRAP_STATIC_SRC_RELATIVE,
] as const;

export const UPGRADE_MERGE_FILES = new Set(["package.json", "dal/dal.config.yaml"]);

export const CANONICAL_EXCLUDE = [
  "node_modules",
  "dist",
  ".turbo",
  "drizzle",
  "src/generated",
] as const;