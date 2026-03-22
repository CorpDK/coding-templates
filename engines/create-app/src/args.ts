import { parseArgs } from "node:util";
import path from "node:path";
import { spinner } from "@clack/prompts";
import type {
  DbChoice,
  DsChoice,
  DocumentImpl,
  DocumentProvider,
  OrmChoice,
  RelationalDbChoice,
  ScaffoldConfig,
  StorageType,
  UiChoice,
} from "./types.js";
import { resolvePackages, DRIZZLE_DB_OPTIONS } from "./packages.js";
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
  storageType: string | undefined;
  orm: string | undefined;
  documentProvider: string | undefined;
  documentImpl: string | undefined;
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
      "storage-type": { type: "string" },
      orm: { type: "string" },
      "document-provider": { type: "string" },
      "document-impl": { type: "string" },
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
    storageType: values["storage-type"] as string | undefined,
    orm: values.orm as string | undefined,
    documentProvider: values["document-provider"] as string | undefined,
    documentImpl: values["document-impl"] as string | undefined,
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

const VALID_STORAGE_TYPES: StorageType[] = ["relational", "document", "filebased"];
const VALID_ORMS: OrmChoice[] = ["prisma", "drizzle"];
const VALID_DOC_PROVIDERS: DocumentProvider[] = ["couchbase", "mongodb", "documentdb"];
const VALID_DOC_IMPLS: DocumentImpl[] = ["standard", "hprt"];
const VALID_UI: UiChoice[] = ["none", "standard", "hprt"];
const VALID_RELATIONAL_DBS: RelationalDbChoice[] = ["postgresql", "mysql", "sqlite", "cockroachdb"];
const VALID_DB_DRIZZLE = DRIZZLE_DB_OPTIONS.map((o) => o.value);

function fail(msg: string): never {
  console.error(`\nError: ${msg}\n`);
  console.error(`Run with --help to see usage.\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Storage hierarchy resolution
// ---------------------------------------------------------------------------

function resolveDocumentDs(args: ParsedArgs): { ds: DsChoice; db: DbChoice | null } {
  const provider = (args.documentProvider as DocumentProvider | undefined) ?? "couchbase";
  if (!VALID_DOC_PROVIDERS.includes(provider)) {
    fail(`--document-provider must be one of: ${VALID_DOC_PROVIDERS.join(", ")}`);
  }
  if (provider === "couchbase") return { ds: "cdb", db: null };

  const impl = (args.documentImpl as DocumentImpl | undefined) ?? "standard";
  if (!VALID_DOC_IMPLS.includes(impl)) {
    fail(`--document-impl must be one of: ${VALID_DOC_IMPLS.join(", ")}`);
  }
  if (impl === "hprt") {
    return { ds: provider === "documentdb" ? "ddb" : "mongo", db: null };
  }
  // Standard (Prisma): reuse "standard" ds with mongodb/documentdb as db
  const db: DbChoice = provider === "documentdb" ? "documentdb" : "mongodb";
  return { ds: "standard", db };
}

function resolveRelationalDs(args: ParsedArgs): { ds: DsChoice; db: DbChoice | null } {
  const orm = (args.orm as OrmChoice | undefined) ?? "prisma";
  if (!VALID_ORMS.includes(orm)) {
    fail(`--orm must be one of: ${VALID_ORMS.join(", ")}`);
  }

  const rawDb = (args.db as RelationalDbChoice | undefined) ?? "postgresql";
  if (!VALID_RELATIONAL_DBS.includes(rawDb)) {
    fail(`--db must be one of: ${VALID_RELATIONAL_DBS.join(", ")}`);
  }
  if (orm === "drizzle" && !VALID_DB_DRIZZLE.includes(rawDb)) {
    fail(`Drizzle does not support ${rawDb}. Choose one of: ${VALID_DB_DRIZZLE.join(", ")}`);
  }

  return { ds: orm === "drizzle" ? "hprt" : "standard", db: rawDb };
}

function resolveDsChoice(args: ParsedArgs): { ds: DsChoice; db: DbChoice | null } {
  const st = args.storageType as StorageType | undefined;

  if (!st) return { ds: "none", db: null };
  if (!VALID_STORAGE_TYPES.includes(st)) {
    fail(`--storage-type must be one of: ${VALID_STORAGE_TYPES.join(", ")}`);
  }
  if (st === "filebased") return { ds: "file", db: null };
  if (st === "document") return resolveDocumentDs(args);
  return resolveRelationalDs(args);
}

async function resolveExternalSdkPackage(
  ui: UiChoice,
  ds: DsChoice,
  sdk: string | undefined
): Promise<string | null> {
  if (ui === "none" || ds !== "none") return null;
  if (!sdk) fail("--sdk is required when --ui is set and --storage-type is omitted (standalone UI mode)");
  if (!sdk.startsWith("@")) fail('--sdk must be a scoped package name like "@acme/ds-sdk"');
  const s = spinner();
  s.start(`Checking if ${sdk} is reachable`);
  try {
    await execAsync(`pnpm info ${sdk} version`);
    s.stop(`${sdk} found`);
  } catch {
    s.stop(`${sdk} not found`);
    console.error(
      `\nError: Package "${sdk}" is not reachable via pnpm.\n` +
        "Publish it to Artifactory (or your npm registry) first, then re-run create-app.\n"
    );
    process.exit(1);
  }
  return sdk;
}

export async function buildConfig(args: ParsedArgs): Promise<ScaffoldConfig> {
  const name = args.name;
  const scope = args.scope;

  if (!name) fail("--name is required");
  if (!scope) fail("--scope is required");

  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    fail("--name must use lowercase letters, numbers, and hyphens only (must start with a letter)");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(scope)) {
    fail("--scope must use lowercase letters, numbers, and hyphens only");
  }

  const { ds, db } = resolveDsChoice(args);

  const ui: UiChoice = (args.ui as UiChoice | undefined) ?? "none";
  if (!VALID_UI.includes(ui)) {
    fail(`--ui must be one of: ${VALID_UI.join(", ")}`);
  }

  // UI / DS compatibility (applies to standard/hprt only — other DS types support both UIs)
  if (ds === "standard" && ui === "hprt") {
    fail("--ui hprt requires --storage-type relational --orm drizzle (standard Prisma DS uses Apollo-based schema)");
  }
  if (ds === "hprt" && ui === "standard") {
    fail("--ui standard requires --storage-type relational --orm prisma (HPRT Drizzle DS uses urql-based schema)");
  }

  const rawOutput = args.output ?? `./${name}`;
  const outputDir = path.resolve(rawOutput);

  if (await pathExists(outputDir)) {
    // In non-interactive mode we proceed silently for non-empty dirs (CI use case)
  }

  const externalSdkPackage = await resolveExternalSdkPackage(ui, ds, args.sdk);
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
create-app — scaffold from coding-templates  (v0.1.0-alpha.1)

Usage:
  pnpm create-app                         Interactive mode (default)
  pnpm create-app --name <n> --scope <s> [options]

Required:
  -n, --name     <name>    Project name (lowercase, hyphens)
  -s, --scope    <scope>   Org scope without @ (e.g. myorg)

Storage hierarchy:
      --storage-type  <type>      relational | document | filebased

  Relational DB (SQL):
      --orm           <orm>       prisma | drizzle  (default: prisma)
      --db            <db>        postgresql | mysql | sqlite | cockroachdb  (default: postgresql)
                                  Drizzle supports all four; Prisma supports all four.

  Document DB (NoSQL):
      --document-provider <p>     couchbase | mongodb | documentdb  (default: couchbase)
      --document-impl     <impl>  standard | hprt  (Prisma vs native SDK, default: standard)
                                  Not applicable for couchbase (SDK only).

  File-Based DB:
      (no further flags — format configured via DS_FILE_FORMAT=json|yaml in .env)

Other options:
  -o, --output   <dir>     Output directory (default: ./<name>)
      --ui       <choice>  UI: none | standard | hprt  (default: none)
      --sdk      <pkg>     Published SDK package (required when --ui != none and no --storage-type)
      --env                Generate .env from .env.example (default: on)
      --no-env             Skip .env generation
      --git                Init git repository (default: on)
      --no-git             Skip git init
  -y, --yes                Accept all defaults (still requires --name and --scope)
  -h, --help               Show this help

Storage / UI compatibility:
  relational + prisma  →  standard ui only (Apollo-based schema)
  relational + drizzle →  hprt ui only (urql-based schema)
  document (any)       →  standard ui or hprt ui
  filebased            →  standard ui or hprt ui

Examples:
  # Relational DB, Drizzle ORM, PostgreSQL, HPRT UI
  pnpm create-app --name my-app --scope myorg --storage-type relational --orm drizzle --db postgresql --ui hprt

  # Relational DB, Prisma ORM, MySQL, standard UI
  pnpm create-app --name my-api --scope myorg --storage-type relational --orm prisma --db mysql --ui standard

  # Document DB, Couchbase
  pnpm create-app --name my-app --scope myorg --storage-type document --document-provider couchbase --ui hprt

  # Document DB, MongoDB, Prisma, standard UI
  pnpm create-app --name my-app --scope myorg --storage-type document --document-provider mongodb --document-impl standard --ui standard

  # File-Based DB, standard UI
  pnpm create-app --name my-app --scope myorg --storage-type filebased --ui standard

  # Standalone UI with external SDK (no DS)
  pnpm create-app --name my-ui --scope myorg --ui standard --sdk @acme/ds-sdk

  # Minimal — bare project, no DS, no UI
  pnpm create-app --name my-app --scope myorg
`);
}
