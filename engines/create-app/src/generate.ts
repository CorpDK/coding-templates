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
  const hasDs = ds !== "none";
  const appPkgs = [...selectedPackages].filter((id) => APP_PACKAGE_IDS.has(id));
  const sharedPkgs = [...selectedPackages].filter(
    (id) => !APP_PACKAGE_IDS.has(id),
  );

  const packageRows = selectedPackages.map((pkgId) => {
    const def = PACKAGE_DEFS[pkgId];
    return `| \`@${orgScope}/${def.dirName}\` | ${def.label} |`;
  });

  const scriptRows = [
    "| `pnpm dev` | Start all packages in dev mode |",
    "| `pnpm build` | Build all packages |",
    "| `pnpm lint` | Lint all packages |",
    ...(hasDs ? ["| `pnpm codegen` | Run GraphQL codegen |"] : []),
    "| `pnpm clean` | Clean all build artifacts |",
  ];

  const lastIdx = appPkgs.length - 1;
  const treeRows = appPkgs.map((id, i) => {
    const def = PACKAGE_DEFS[id];
    const prefix = i === lastIdx ? "└──" : "├──";
    return `│   ${prefix} ${def.dirName}/`;
  });

  const sharedSection: string[] = [];
  if (sharedPkgs.length > 0) {
    const names = sharedPkgs
      .map((id) => `\`@${orgScope}/${PACKAGE_DEFS[id].dirName}\``)
      .join(", ");
    sharedSection.push(
      `Shared UI libraries (${names}) are consumed as npm dependencies.`,
      "",
    );
  }

  const lines: string[] = [
    `# ${projectName}`,
    "",
    "> Scaffolded with [@corpdk/create-app](https://github.com/corpdk/coding-templates)",
    "",
    "## Quick Start",
    "",
    "```bash",
    "pnpm install",
    "pnpm dev",
    "```",
    "",
    "## Packages",
    "",
    "| Package | Description |",
    "|---------|-------------|",
    ...packageRows,
    "",
    "## Scripts",
    "",
    "| Command | Description |",
    "|---------|-------------|",
    ...scriptRows,
    "",
    "## Environment Variables",
    "",
    "Copy `.env.example` to `.env` in each package directory before running.",
    "",
    "## Project Structure",
    "",
    "```",
    `${projectName}/`,
    "├── packages/",
    ...treeRows,
    "├── turbo.json",
    "└── package.json",
    "```",
    "",
    ...sharedSection,
  ];

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
