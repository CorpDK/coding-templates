import {
  firstPublishOrderMismatch,
  loadOrderedPackages,
  trustedPackagesErrors,
  type PkgJson,
} from "./publish-load.js";

export type PackageRef = {
  name: string;
  packageJsonPath: string;
};

export type PublishOrderGuardOptions = {
  repoRoot: string;
  publishOrder: readonly string[];
  packageJsonPath: (name: string) => string;
  trustedPackages?: readonly string[];
  workflowFile?: string;
};

function depEdges(pkg: PkgJson, orderSet: Set<string>): string[] {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const out: string[] = [];
  for (const key of Object.keys(deps ?? {})) {
    if (key.startsWith("@corpdk/") && orderSet.has(key)) {
      out.push(key);
    }
  }
  return out;
}

function topologicalSort(
  packages: Map<string, PkgJson>,
  orderSet: Set<string>,
): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: string[] = [];

  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Circular @corpdk dependency involving ${name}`);
    }
    visiting.add(name);
    const pkg = packages.get(name);
    if (pkg) {
      for (const dep of depEdges(pkg, orderSet)) {
        visit(dep);
      }
    }
    visiting.delete(name);
    visited.add(name);
    sorted.push(name);
  }

  for (const name of orderSet) {
    visit(name);
  }

  return sorted;
}

export type PublishOrderGuardResult = {
  ok: boolean;
  errors: string[];
  derivedOrder: string[];
};

export async function checkPublishOrder(
  options: PublishOrderGuardOptions,
): Promise<PublishOrderGuardResult> {
  const orderSet = new Set(options.publishOrder);
  const { packages, errors } = await loadOrderedPackages(
    options.repoRoot,
    options.publishOrder,
    options.packageJsonPath,
  );

  let derivedOrder: string[] = [];
  try {
    derivedOrder = topologicalSort(packages, orderSet);
  } catch (err: unknown) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { ok: false, errors, derivedOrder: [] };
  }

  const mismatch = firstPublishOrderMismatch(
    options.publishOrder,
    derivedOrder,
  );
  if (mismatch) {
    errors.push(mismatch);
  }

  const workflow = options.workflowFile ?? "publish-ds-automation.yml";
  errors.push(
    ...trustedPackagesErrors(options.trustedPackages, orderSet, workflow),
  );

  return { ok: errors.length === 0, errors, derivedOrder };
}

export const DS_AUTOMATION_PUBLISH_ORDER = [
  "@corpdk/graphql-dsl",
  "@corpdk/scalar-zod",
  "@corpdk/dal-core",
  "@corpdk/pub-sub",
  "@corpdk/graphql-input-zod",
  "@corpdk/dal-codegen",
  "@corpdk/engine-kit",
  "@corpdk/graphql-cli-core",
  "@corpdk/create-graphql-sdk",
  "@corpdk/create-graphql-cli",
  "@corpdk/codegen-cli",
  "@corpdk/create-ds",
] as const;

export const DS_AUTOMATION_PACKAGE_JSON_PATH: Record<string, string> = {
  "@corpdk/graphql-dsl": "libraries/graphql-dsl/package.json",
  "@corpdk/scalar-zod": "libraries/scalar-zod/package.json",
  "@corpdk/dal-core": "libraries/dal-core/package.json",
  "@corpdk/pub-sub": "libraries/pub-sub/package.json",
  "@corpdk/graphql-input-zod": "libraries/graphql-input-zod/package.json",
  "@corpdk/dal-codegen": "libraries/dal-codegen/package.json",
  "@corpdk/engine-kit": "libraries/engine-kit/package.json",
  "@corpdk/graphql-cli-core": "libraries/graphql-cli-core/package.json",
  "@corpdk/create-graphql-sdk": "engines/create-graphql-sdk/package.json",
  "@corpdk/create-graphql-cli": "engines/create-graphql-cli/package.json",
  "@corpdk/codegen-cli": "libraries/codegen-cli/package.json",
  "@corpdk/create-ds": "engines/create-ds/package.json",
};

/** B0 generator packages that must have npm trusted publishing configured. */
export const DS_AUTOMATION_TRUSTED_PACKAGES = [
  "@corpdk/scalar-zod",
  "@corpdk/graphql-input-zod",
  "@corpdk/graphql-dsl",
  "@corpdk/engine-kit",
  "@corpdk/graphql-cli-core",
  "@corpdk/create-graphql-sdk",
  "@corpdk/create-graphql-cli",
] as const;
