import { parseArgs } from "node:util";
import path from "node:path";
import { spinner } from "@clack/prompts";
import type { DbChoice, DsChoice, ScaffoldConfig, UiChoice } from "./types.js";
import { resolvePackages, resolveUiSdkDep, DRIZZLE_DB_OPTIONS } from "./packages.js";
import { execAsync, pathExists } from "./utils.js";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function isNonInteractive(): boolean {
  return process.argv.includes("--name") || process.argv.includes("-n");
}

interface ParsedArgs {
  name: string | undefined;
  scope: string | undefined;
  output: string | undefined;
  ds: string | undefined;
  db: string | undefined;
  ui: string | undefined;
  sdk: string | undefined;
  env: boolean;
  git: boolean;
  yes: boolean;
  help: boolean;
}

export function parseCliArgs(): ParsedArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: "string", short: "n" },
      scope: { type: "string", short: "s" },
      output: { type: "string", short: "o" },
      ds: { type: "string" },
      db: { type: "string" },
      ui: { type: "string" },
      sdk: { type: "string" },
      env: { type: "boolean", default: true },
      "no-env": { type: "boolean", default: false },
      git: { type: "boolean", default: true },
      "no-git": { type: "boolean", default: false },
      yes: { type: "boolean", short: "y", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
  });

  const noEnv = (values["no-env"] as boolean | undefined) ?? false;
  const noGit = (values["no-git"] as boolean | undefined) ?? false;

  return {
    name: values.name as string | undefined,
    scope: values.scope as string | undefined,
    output: values.output as string | undefined,
    ds: values.ds as string | undefined,
    db: values.db as string | undefined,
    ui: values.ui as string | undefined,
    sdk: values.sdk as string | undefined,
    env: noEnv ? false : ((values.env as boolean | undefined) ?? true),
    git: noGit ? false : ((values.git as boolean | undefined) ?? true),
    yes: (values.yes as boolean | undefined) ?? false,
    help: (values.help as boolean | undefined) ?? false,
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_DS: DsChoice[] = ["none", "standard", "hprt", "cdb"];
const VALID_UI: UiChoice[] = ["none", "standard", "hprt"];
const VALID_DB_ALL: DbChoice[] = ["postgresql", "mysql", "sqlite", "cockroachdb", "mongodb"];
const VALID_DB_DRIZZLE = DRIZZLE_DB_OPTIONS.map((o) => o.value);

function fail(msg: string): never {
  console.error(`\nError: ${msg}\n`);
  console.error(`Run with --help to see usage.\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Build ScaffoldConfig from parsed flags
// ---------------------------------------------------------------------------

export async function buildConfig(args: ParsedArgs): Promise<ScaffoldConfig> {
  // Required fields
  const name = args.name;
  const scope = args.scope;

  if (!name) fail("--name is required");
  if (!scope) fail("--scope is required");

  // Validate formats
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    fail("--name must use lowercase letters, numbers, and hyphens only (must start with a letter)");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(scope)) {
    fail("--scope must use lowercase letters, numbers, and hyphens only");
  }

  // DS
  const ds: DsChoice = (args.ds as DsChoice | undefined) ?? "none";
  if (!VALID_DS.includes(ds)) {
    fail(`--ds must be one of: ${VALID_DS.join(", ")}`);
  }

  // DB
  let db: DbChoice | null = null;
  if (ds === "standard" || ds === "hprt") {
    const rawDb = (args.db as DbChoice | undefined) ?? "postgresql";
    if (!VALID_DB_ALL.includes(rawDb)) {
      fail(`--db must be one of: ${VALID_DB_ALL.join(", ")}`);
    }
    if (ds === "hprt" && !VALID_DB_DRIZZLE.includes(rawDb)) {
      fail(`MongoDB is not supported by Drizzle (--ds hprt). Choose one of: ${VALID_DB_DRIZZLE.join(", ")}`);
    }
    db = rawDb;
  }

  // UI
  const ui: UiChoice = (args.ui as UiChoice | undefined) ?? "none";
  if (!VALID_UI.includes(ui)) {
    fail(`--ui must be one of: ${VALID_UI.join(", ")}`);
  }

  // DS/UI compatibility
  if (ds === "standard" && ui === "hprt") {
    fail("--ui hprt is not compatible with --ds standard (incompatible schemas). Use --ui standard or --ds hprt.");
  }
  if (ds === "hprt" && ui === "standard") {
    fail("--ui standard is not compatible with --ds hprt (incompatible schemas). Use --ui hprt or --ds standard.");
  }

  // Output directory
  const rawOutput = args.output ?? `./${name}`;
  const outputDir = path.resolve(rawOutput);

  if (await pathExists(outputDir)) {
    // In non-interactive mode we proceed silently for non-empty dirs (CI use case)
  }

  // External SDK (UI-only standalone mode)
  let externalSdkPackage: string | null = null;
  if (ui !== "none" && ds === "none") {
    const sdkPkg = args.sdk;
    if (!sdkPkg) {
      fail("--sdk is required when --ui is set and --ds is none (standalone UI mode)");
    }
    if (!sdkPkg.startsWith("@")) {
      fail('--sdk must be a scoped package name like "@acme/ds-sdk"');
    }

    const s = spinner();
    s.start(`Checking if ${sdkPkg} is reachable`);
    try {
      await execAsync(`pnpm info ${sdkPkg} version`);
      s.stop(`${sdkPkg} found`);
    } catch {
      s.stop(`${sdkPkg} not found`);
      console.error(
        `\nError: Package "${sdkPkg}" is not reachable via pnpm.\n` +
          "Publish it to Artifactory (or your npm registry) first, then re-run create-app.\n"
      );
      process.exit(1);
    }

    externalSdkPackage = sdkPkg;
  }

  const selectedPackages = resolvePackages(ds, ui);
  const projectType = ds === "none" && ui !== "none" ? "standalone" : "monorepo";

  return {
    projectName: name,
    orgScope: scope,
    outputDir,
    ds,
    db,
    ui,
    externalSdkPackage,
    projectType,
    selectedPackages,
    generateEnv: args.env,
    initGit: args.git,
  };
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

export function printHelp(): void {
  console.log(`
create-app — scaffold from coding-templates

Usage:
  pnpm create-app                         Interactive mode (default)
  pnpm create-app --name <n> --scope <s> [options]

Options:
  -n, --name     <name>    Project name (lowercase, hyphens)
  -s, --scope    <scope>   Org scope without @ (e.g. myorg)
  -o, --output   <dir>     Output directory (default: ./<name>)
      --ds       <choice>  Data service: none | standard | hprt | cdb  (default: none)
      --db       <choice>  Database: postgresql | mysql | sqlite | cockroachdb | mongodb
                           Prisma (standard ds): all five.
                           Drizzle (hprt ds): postgresql | mysql | sqlite | cockroachdb.
                           (default: postgresql)
      --ui       <choice>  UI: none | standard | hprt  (default: none)
      --sdk      <pkg>     Published SDK package (required when --ui != none and --ds none)
      --env                Generate .env from .env.example (default: on)
      --no-env             Skip .env generation
      --git                Init git repository (default: on)
      --no-git             Skip git init
  -y, --yes                Accept all defaults (still requires --name and --scope)
  -h, --help               Show this help

DS / UI compatibility:
  standard ds  →  standard ui only
  hprt ds      →  hprt ui only
  cdb ds       →  standard ui or hprt ui (SDK remapped to ds-sdk-cdb)
  none ds      →  standard ui or hprt ui (requires --sdk)

Examples:
  # Full monorepo: HPRT stack + MySQL
  pnpm create-app --name my-app --scope myorg --ds hprt --db mysql --ui hprt

  # DS only (no UI), Standard stack with SQLite
  pnpm create-app --name my-api --scope myorg --ds standard --db sqlite

  # CDB stack, HPRT UI
  pnpm create-app --name my-app --scope myorg --ds cdb --ui hprt

  # Standalone UI with external SDK
  pnpm create-app --name my-ui --scope myorg --ui standard --sdk @acme/ds-sdk

  # Minimal — bare project, no DS, no UI
  pnpm create-app --name my-app --scope myorg
`);
}
