import type { PackageId } from "./types.js";
import { getBuiltDeps } from "./packages.js";

interface RootPackageJsonSource {
  devDependencies: Record<string, string>;
  packageManager: string;
}

export function generateRootPackageJson(
  projectName: string,
  orgScope: string,
  source: RootPackageJsonSource
): string {
  const pkg = {
    name: `@${orgScope}/${projectName}`,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "turbo run dev",
      build: "turbo run build",
      start: "turbo run start",
      lint: "turbo run lint",
      codegen: "turbo run codegen",
      clean: "turbo run clean",
    },
    devDependencies: {
      turbo: source.devDependencies["turbo"] ?? "^2.5.4",
      typescript: source.devDependencies["typescript"] ?? "^5.9.3",
    },
    packageManager: source.packageManager,
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

export function generateWorkspaceYaml(selected: Set<PackageId>): string {
  const builtDeps = getBuiltDeps(selected);
  const ignoredDeps = ["sharp", "unrs-resolver"];

  let yaml = `packages:\n  - packages/*\n\n`;
  yaml += `ignoredBuiltDependencies:\n`;
  yaml += ignoredDeps.map((d) => `  - ${d}`).join("\n") + "\n";
  if (builtDeps.length > 0) {
    yaml += `\nonlyBuiltDependencies:\n`;
    yaml += builtDeps.map((d) => `  - '${d}'`).join("\n") + "\n";
  }
  return yaml;
}

export function generateStandalonePackageJson(
  projectName: string,
  orgScope: string,
  templatePkgJson: Record<string, unknown>
): string {
  const pkg = {
    ...(templatePkgJson as object),
    name: `@${orgScope}/${projectName}`,
    version: "0.1.0",
    private: true,
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}
