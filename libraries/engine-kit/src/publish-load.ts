import path from "node:path";
import { readJson } from "./fs.js";

export type PkgJson = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export async function loadOrderedPackages(
  repoRoot: string,
  publishOrder: readonly string[],
  packageJsonPath: (name: string) => string,
): Promise<{ packages: Map<string, PkgJson>; errors: string[] }> {
  const errors: string[] = [];
  const packages = new Map<string, PkgJson>();

  const loaded = await Promise.all(
    publishOrder.map(async (name) => {
      const rel = packageJsonPath(name);
      const full = path.join(repoRoot, rel);
      try {
        const pkg = await readJson<PkgJson>(full);
        if (pkg.name && pkg.name !== name) {
          errors.push(`${rel}: name is ${pkg.name}, expected ${name}`);
        }
        return { name, pkg };
      } catch (err: unknown) {
        errors.push(
          `Cannot read ${rel}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return { name, pkg: null as PkgJson | null };
      }
    }),
  );

  for (const row of loaded) {
    if (row.pkg) {
      packages.set(row.name, row.pkg);
    }
  }

  return { packages, errors };
}

export function firstPublishOrderMismatch(
  actual: readonly string[],
  derived: readonly string[],
): string | null {
  if (actual.length !== derived.length) {
    return "PUBLISH_ORDER length differs from derived topological order";
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== derived[i]) {
      return `PUBLISH_ORDER mismatch at index ${i}: got ${actual[i]}, expected ${derived[i]} (dependency order)`;
    }
  }
  return null;
}

export function trustedPackagesErrors(
  trusted: readonly string[] | undefined,
  orderSet: Set<string>,
  workflow: string,
): string[] {
  const errors: string[] = [];
  for (const name of trusted ?? []) {
    if (!orderSet.has(name)) {
      errors.push(
        `Trusted-publisher manifest lists ${name} but it is missing from PUBLISH_ORDER (workflow ${workflow})`,
      );
    }
  }
  return errors;
}
