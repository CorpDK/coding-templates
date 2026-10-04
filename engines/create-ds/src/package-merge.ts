type PkgJson = {
  name?: string;
  version?: string;
  description?: string;
  publishConfig?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const CORP_DK_BUMP = new Set([
  "@corpdk/dal-core",
  "@corpdk/pub-sub",
  "@corpdk/codegen-cli",
  "@corpdk/dal-codegen",
]);

/** Use published CLI bins instead of monorepo-relative dal-codegen paths. */
export function normalizeDalScripts(
  scripts: Record<string, string>,
): Record<string, string> {
  const out = { ...scripts };
  out["dal:codegen:schema"] = "dal-codegen --mode=schema";
  out["dal:codegen:impl"] = "dal-codegen --mode=impl";
  out["dal:codegen:bootstrap"] = "dal-codegen --mode=bootstrap";
  out["entity:lint"] = "dal-entity-lint";
  return out;
}

export function mergePackageJson(consumer: PkgJson, template: PkgJson): PkgJson {
  const merged: PkgJson = {
    ...template,
    name: consumer.name ?? template.name,
    version: consumer.version ?? template.version,
    description: consumer.description ?? template.description,
    publishConfig: consumer.publishConfig ?? template.publishConfig,
    scripts: normalizeDalScripts(template.scripts ?? {}),
    dependencies: { ...(template.dependencies ?? {}) },
    devDependencies: { ...(template.devDependencies ?? {}) },
  };

  if (consumer.dependencies) {
    for (const [key, value] of Object.entries(consumer.dependencies)) {
      if (!CORP_DK_BUMP.has(key)) {
        merged.dependencies![key] = value;
      }
    }
  }

  if (consumer.devDependencies) {
    for (const [key, value] of Object.entries(consumer.devDependencies)) {
      if (!CORP_DK_BUMP.has(key)) {
        merged.devDependencies![key] = value;
      }
    }
  }

  return merged;
}
