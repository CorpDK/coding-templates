import type { PackageId, ScaffoldConfig } from "./types.js";
import { getBuiltDeps, PACKAGE_DEFS } from "./packages.js";

interface RootPackageJsonSource {
  devDependencies: Record<string, string>;
  packageManager: string;
  pnpm?: { overrides?: Record<string, string> };
}

interface RootPackageJsonOptions {
  /** True when the scaffold includes a DS variant — adds db:generate root script */
  hasDs: boolean;
}

export function generateRootPackageJson(
  projectName: string,
  orgScope: string,
  source: RootPackageJsonSource,
  options: RootPackageJsonOptions,
): string {
  const scripts: Record<string, string> = {
    dev: "turbo run dev --concurrency=20",
    build: "turbo run build",
    start: "turbo run start",
    lint: "turbo run lint",
    codegen: "turbo run codegen",
    clean: "turbo run clean",
  };
  if (options.hasDs) {
    scripts["db:generate"] = "turbo run db:generate";
  }

  const pkg: Record<string, unknown> = {
    name: `@${orgScope}/${projectName}`,
    version: "0.1.0",
    private: true,
    scripts,
    devDependencies: {
      turbo: source.devDependencies["turbo"] ?? "^2.5.4",
      typescript: source.devDependencies["typescript"] ?? "^5.9.3",
    },
  };
  if (source.pnpm?.overrides && Object.keys(source.pnpm.overrides).length > 0) {
    pkg["pnpm"] = { overrides: source.pnpm.overrides };
  }
  pkg["packageManager"] = source.packageManager;
  return JSON.stringify(pkg, null, 2) + "\n";
}

export function generateWorkspaceYaml(selected: Set<PackageId>): string {
  const builtDeps = getBuiltDeps(selected);
  const ignoredDeps = ["sharp", "unrs-resolver"];

  let yaml = `packages:\n  - libraries/*\n  - packages/*\n\n`;
  yaml += `ignoredBuiltDependencies:\n`;
  yaml += ignoredDeps.map((d) => `  - ${d}`).join("\n") + "\n";
  if (builtDeps.length > 0) {
    yaml += `\nonlyBuiltDependencies:\n`;
    yaml += builtDeps.map((d) => `  - '${d}'`).join("\n") + "\n";
  }
  return yaml;
}

/** App-level packages that live in packages/ — shared libs are npm deps */
const APP_PACKAGE_IDS = new Set<PackageId>([
  "ds",
  "ds-hprt",
  "ds-cdb",
  "ds-mongo",
  "ds-ddb",
  "ds-file",
  "ds-sdk",
  "ds-cli",
  "ui",
  "ui-hprt",
]);

export function generateReadme(config: ScaffoldConfig): string {
  const { projectName, orgScope, selectedPackages, ds } = config;
  const lines: string[] = [];

  lines.push(`# ${projectName}`);
  lines.push("");
  lines.push(
    "> Scaffolded with [@corpdk/create-app](https://github.com/corpdk/coding-templates)",
  );
  lines.push("");

  // Quick Start
  lines.push("## Quick Start");
  lines.push("");
  lines.push("```bash");
  lines.push("pnpm install");
  lines.push("pnpm dev");
  lines.push("```");
  lines.push("");

  // Packages table
  lines.push("## Packages");
  lines.push("");
  lines.push("| Package | Description |");
  lines.push("|---------|-------------|");
  for (const pkgId of selectedPackages) {
    const def = PACKAGE_DEFS[pkgId];
    lines.push(`| \`@${orgScope}/${def.dirName}\` | ${def.label} |`);
  }
  lines.push("");

  // Scripts
  const hasDs = ds !== "none";
  lines.push("## Scripts");
  lines.push("");
  lines.push("| Command | Description |");
  lines.push("|---------|-------------|");
  lines.push("| `pnpm dev` | Start all packages in dev mode |");
  lines.push("| `pnpm build` | Build all packages |");
  lines.push("| `pnpm lint` | Lint all packages |");
  if (hasDs) {
    lines.push("| `pnpm codegen` | Run GraphQL codegen |");
  }
  lines.push("| `pnpm clean` | Clean all build artifacts |");
  lines.push("");

  // Environment Variables
  lines.push("## Environment Variables");
  lines.push("");
  lines.push(
    "Copy `.env.example` to `.env` in each package directory before running.",
  );
  lines.push("");

  // Project Structure
  lines.push("## Project Structure");
  lines.push("");
  lines.push("```");
  lines.push(`${projectName}/`);
  lines.push("├── packages/");

  const appPkgs = [...selectedPackages].filter((id) => APP_PACKAGE_IDS.has(id));
  const lastIdx = appPkgs.length - 1;
  for (let i = 0; i < appPkgs.length; i++) {
    const def = PACKAGE_DEFS[appPkgs[i]];
    const prefix = i === lastIdx ? "└──" : "├──";
    lines.push(`│   ${prefix} ${def.dirName}/`);
  }

  lines.push("├── turbo.json");
  lines.push("└── package.json");
  lines.push("```");
  lines.push("");

  const sharedPkgs = [...selectedPackages].filter(
    (id) => !APP_PACKAGE_IDS.has(id),
  );
  if (sharedPkgs.length > 0) {
    const names = sharedPkgs
      .map((id) => `\`@${orgScope}/${PACKAGE_DEFS[id].dirName}\``)
      .join(", ");
    lines.push(
      `Shared UI libraries (${names}) are consumed as npm dependencies.`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

export function generateStandalonePackageJson(
  projectName: string,
  orgScope: string,
  templatePkgJson: Record<string, unknown>,
): string {
  const pkg = {
    ...(templatePkgJson as object),
    name: `@${orgScope}/${projectName}`,
    version: "0.1.0",
    private: true,
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}
