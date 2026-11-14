type PkgJson = {
  name?: string;
  version?: string;
  description?: string;
  publishConfig?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

export type MergePackageJsonOptions = {
  owned?: ReadonlySet<string>;
  removed?: ReadonlySet<string>;
  preserveKeys?: readonly string[];
  scriptsTransform?: (scripts: Record<string, string>) => Record<string, string>;
  releaseVersion?: string;
};

const DEFAULT_PRESERVE_KEYS = [
  "private",
  "license",
  "engines",
  "packageManager",
  "author",
  "repository",
  "bugs",
  "homepage",
  "keywords",
  "bin",
  "man",
  "publishConfig",
] as const;

function rewriteCorpdkWorkspaceDeps(
  deps: Record<string, string> | undefined,
  releaseVersion: string,
): Record<string, string> {
  if (!deps) return {};
  const out = { ...deps };
  for (const [key, value] of Object.entries(out)) {
    if (
      key.startsWith("@corpdk/") &&
      (value === "workspace:*" || value === "workspace:^")
    ) {
      out[key] = `^${releaseVersion}`;
    }
  }
  return out;
}

function mergeDepRecords(
  templateDeps: Record<string, string> | undefined,
  consumerDeps: Record<string, string> | undefined,
  owned: ReadonlySet<string>,
  removed: ReadonlySet<string>,
): Record<string, string> {
  const merged = templateDeps ? { ...templateDeps } : {};
  for (const key of removed) {
    delete merged[key];
  }
  if (!consumerDeps) return merged;
  for (const [key, value] of Object.entries(consumerDeps)) {
    if (!owned.has(key)) {
      merged[key] = value;
    }
  }
  return merged;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeYamlConfig(
  template: unknown,
  consumer: unknown,
): unknown {
  if (!isPlainObject(template)) return consumer ?? template;
  if (!isPlainObject(consumer)) return { ...template };

  const out: Record<string, unknown> = { ...template };
  for (const [key, consumerVal] of Object.entries(consumer)) {
    const templateVal = template[key];
    if (isPlainObject(templateVal) && isPlainObject(consumerVal)) {
      out[key] = mergeYamlConfig(templateVal, consumerVal);
    } else {
      out[key] = consumerVal;
    }
  }
  return out;
}

export function mergePackageJson(
  consumer: PkgJson,
  template: PkgJson,
  options?: MergePackageJsonOptions,
): PkgJson {
  const owned = options?.owned ?? new Set<string>();
  const removed = options?.removed ?? new Set<string>();
  const preserveKeys = options?.preserveKeys ?? DEFAULT_PRESERVE_KEYS;
  const scriptsTransform = options?.scriptsTransform ?? ((s) => s);

  const merged: PkgJson = {
    ...template,
    name: consumer.name ?? template.name,
    version: consumer.version ?? template.version,
    description: consumer.description ?? template.description,
    scripts: scriptsTransform(template.scripts ?? {}),
    dependencies: mergeDepRecords(
      template.dependencies,
      consumer.dependencies,
      owned,
      removed,
    ),
    devDependencies: mergeDepRecords(
      template.devDependencies,
      consumer.devDependencies,
      owned,
      removed,
    ),
  };

  if (options?.releaseVersion) {
    merged.dependencies = rewriteCorpdkWorkspaceDeps(
      merged.dependencies,
      options.releaseVersion,
    );
    merged.devDependencies = rewriteCorpdkWorkspaceDeps(
      merged.devDependencies,
      options.releaseVersion,
    );
  }

  for (const key of preserveKeys) {
    if (Object.prototype.hasOwnProperty.call(consumer, key)) {
      merged[key] = consumer[key];
    }
  }

  return merged;
}