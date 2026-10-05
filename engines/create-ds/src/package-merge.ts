const CONSUMER_PRESERVED_TOP_LEVEL = [
  "private",
  "license",
  "engines",
  "packageManager",
  "author",
  "repository",
  "bugs",
  "homepage",
  "keywords",
] as const;

type PkgJson = {
  name?: string;
  version?: string;
  description?: string;
  publishConfig?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  type?: string;
  [key: string]: unknown;
};

const CORP_DK_BUMP = new Set([
  "@corpdk/dal-core",
  "@corpdk/pub-sub",
  "@corpdk/codegen-cli",
  "@corpdk/dal-codegen",
]);

const DAL_CODEGEN_CLI = "node ./node_modules/@corpdk/dal-codegen/dist/cli.js";
const DAL_ENTITY_LINT_CLI =
  "node ./node_modules/@corpdk/dal-codegen/dist/lint-cli.js";

/** Invoke dal-codegen via installed package (works before pnpm .bin links exist). */
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

export type MergePackageJsonOptions = {
  /** When set, `workspace:*` @corpdk/* deps use `^${publishedCorpdkVersions}` (published CLI init). */
  publishedCorpdkVersions?: string;
};

function rewriteCorpdkWorkspaceDeps(
  deps: Record<string, string> | undefined,
  releaseVersion: string,
): Record<string, string> {
  if (!deps) return {};
  const out = { ...deps };
  for (const [key, value] of Object.entries(out)) {
    if (key.startsWith("@corpdk/") && value === "workspace:*") {
      out[key] = `^${releaseVersion}`;
    }
  }
  return out;
}

function mergeConsumerDeps(
  templateDeps: Record<string, string> | undefined,
  consumerDeps: Record<string, string> | undefined,
): Record<string, string> {
  const merged = templateDeps ? { ...templateDeps } : {};
  if (!consumerDeps) return merged;
  for (const [key, value] of Object.entries(consumerDeps)) {
    if (!CORP_DK_BUMP.has(key)) {
      merged[key] = value;
    }
  }
  return merged;
}

function copyPreservedConsumerFields(merged: PkgJson, consumer: PkgJson): void {
  for (const key of CONSUMER_PRESERVED_TOP_LEVEL) {
    if (Object.prototype.hasOwnProperty.call(consumer, key)) {
      merged[key] = consumer[key];
    }
  }
}

export function mergePackageJson(
  consumer: PkgJson,
  template: PkgJson,
  options?: MergePackageJsonOptions,
): PkgJson {
  const merged: PkgJson = {
    ...template,
    name: consumer.name ?? template.name,
    version: consumer.version ?? template.version,
    description: consumer.description ?? template.description,
    publishConfig: consumer.publishConfig,
    scripts: normalizeDalScripts(template.scripts ?? {}),
    dependencies: mergeConsumerDeps(
      template.dependencies,
      consumer.dependencies,
    ),
    devDependencies: mergeConsumerDeps(
      template.devDependencies,
      consumer.devDependencies,
    ),
  };

  if (options?.publishedCorpdkVersions) {
    merged.dependencies = rewriteCorpdkWorkspaceDeps(
      merged.dependencies,
      options.publishedCorpdkVersions,
    );
    merged.devDependencies = rewriteCorpdkWorkspaceDeps(
      merged.devDependencies,
      options.publishedCorpdkVersions,
    );
  }

  copyPreservedConsumerFields(merged, consumer);

  return merged;
}
