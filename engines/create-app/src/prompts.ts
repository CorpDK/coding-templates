import {
  cancel,
  confirm,
  intro,
  isCancel,
  note,
  select,
  spinner,
  text,
} from "@clack/prompts";
import path from "node:path";
import type {
  DbChoice,
  DocumentImpl,
  DocumentProvider,
  DsChoice,
  OrmChoice,
  RelationalDbChoice,
  ScaffoldConfig,
  ScaffoldTarget,
  StorageType,
  UiChoice,
} from "./types.js";
import {
  DRIZZLE_DB_OPTIONS,
  PRISMA_DB_OPTIONS,
  resolvePackages,
} from "./packages.js";
import { execAsync, isDirEmpty, pathExists } from "./utils.js";

function bail(msg = "Scaffolding cancelled."): never {
  cancel(msg);
  process.exit(0);
}

function checkCancel<T>(value: T | symbol): T {
  if (isCancel(value)) bail();
  return value as T;
}

async function checkOutputDir(outputDir: string): Promise<void> {
  if (await pathExists(outputDir)) {
    const empty = await isDirEmpty(outputDir);
    if (!empty) {
      const proceed = checkCancel(
        await confirm({
          message: `Directory ${outputDir} already exists and is not empty. Continue anyway?`,
          initialValue: false,
        })
      );
      if (!proceed) bail("Aborted — choose an empty directory.");
    }
  }
}

async function promptExternalSdk(ui: UiChoice, ds: DsChoice): Promise<string | null> {
  if (ui === "none" || ds !== "none") return null;
  note(
    "The UI package requires an SDK package.\n" +
      "Since no storage is included, provide the published npm package name\n" +
      "for the TypedDocumentNode SDK (e.g. @acme/ds-sdk).",
    "External SDK required"
  );
  const sdkPkg = checkCancel(
    await text({
      message: "Published SDK package name",
      placeholder: "@acme/ds-sdk",
      validate: (v) => {
        if (!v) return "SDK package name is required";
        if (!v.startsWith("@"))
          return 'Expected a scoped package name like "@acme/ds-sdk"';
      },
    })
  );
  const s = spinner();
  s.start(`Checking if ${sdkPkg} is reachable`);
  try {
    await execAsync(`pnpm info ${sdkPkg} version`);
    s.stop(`${sdkPkg} found`);
  } catch {
    s.stop(`${sdkPkg} not found`);
    cancel(
      `Package "${sdkPkg}" is not reachable via pnpm.\n` +
        "Publish it to Artifactory (or your npm registry) first, then re-run create-app."
    );
    process.exit(1);
  }
  return sdkPkg;
}

/**
 * Derive DsChoice and db from the storage hierarchy selections.
 * For relational, db is null here and set separately by the DB prompt.
 * For document (MongoDB/DocumentDB + Prisma), db is derived automatically.
 */
function deriveDsChoice(
  storageType: StorageType,
  orm: OrmChoice | null,
  docProvider: DocumentProvider | null,
  docImpl: DocumentImpl | null
): { ds: DsChoice; db: DbChoice | null } {
  if (storageType === "filebased") return { ds: "file", db: null };

  if (storageType === "document") {
    if (docProvider === "couchbase" || !docProvider) return { ds: "cdb", db: null };
    if (docImpl === "hprt") {
      return { ds: docProvider === "documentdb" ? "ddb" : "mongo", db: null };
    }
    // Standard (Prisma): reuse "standard" ds with mongodb/documentdb as db
    const db: DbChoice = docProvider === "documentdb" ? "documentdb" : "mongodb";
    return { ds: "standard", db };
  }

  // relational
  return { ds: orm === "drizzle" ? "hprt" : "standard", db: null };
}

async function promptStorageAndDb(
  storageType?: StorageType
): Promise<{ ds: DsChoice; db: DbChoice | null }> {
  // 4a. Storage type
  const selectedStorageType = storageType ?? checkCancel(
    await select<StorageType>({
      message: "Storage type",
      options: [
        {
          value: "relational",
          label: "Relational DB (SQL)  —  PostgreSQL · MySQL · SQLite · CockroachDB",
        },
        {
          value: "document",
          label: "Document DB (NoSQL)  —  Couchbase · MongoDB · DocumentDB",
        },
        {
          value: "filebased",
          label: "File-Based DB  —  JSON/YAML, zero dependencies, compatible abstraction with Document DB",
        },
      ],
    })
  );

  // 4b. ORM (Relational only)
  let orm: OrmChoice | null = null;
  if (selectedStorageType === "relational") {
    orm = checkCancel(
      await select<OrmChoice>({
        message: "ORM",
        options: [
          {
            value: "prisma",
            label: "Prisma  —  standard, all 4 relational databases",
          },
          {
            value: "drizzle",
            label: "Drizzle  —  high-performance real-time, all 4 relational databases",
          },
        ],
      })
    );
  }

  // 4c. Document DB provider (Document only)
  let docProvider: DocumentProvider | null = null;
  if (selectedStorageType === "document") {
    docProvider = checkCancel(
      await select<DocumentProvider>({
        message: "Document DB provider",
        options: [
          { value: "couchbase", label: "Couchbase  —  Capella cloud or self-hosted" },
          { value: "mongodb", label: "MongoDB  —  Atlas or self-hosted" },
          {
            value: "documentdb",
            label: "DocumentDB  —  documentdb.io open-source (MongoDB-compatible)",
          },
        ],
      })
    );
  }

  // 4d. Implementation (MongoDB / DocumentDB only)
  let docImpl: DocumentImpl | null = null;
  if (docProvider === "mongodb" || docProvider === "documentdb") {
    docImpl = checkCancel(
      await select<DocumentImpl>({
        message: "Implementation",
        options: [
          { value: "standard", label: "Standard  —  Prisma ORM (uses MongoDB connector)" },
          {
            value: "hprt",
            label: "HPRT  —  Native SDK, no ORM overhead",
          },
        ],
      })
    );
  }

  // Derive ds and initial db from the storage hierarchy
  const { ds, db: derivedDb } = deriveDsChoice(selectedStorageType, orm, docProvider, docImpl);

  // 5. DB selection (Relational only — db is derived for Document paths)
  let db: DbChoice | null = derivedDb;

  if (selectedStorageType === "relational" && orm === "prisma") {
    db = checkCancel(
      await select<RelationalDbChoice>({
        message: "Database (Prisma)",
        options: PRISMA_DB_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          hint: o.value === "postgresql" ? "default" : undefined,
        })),
      })
    );
  } else if (selectedStorageType === "relational" && orm === "drizzle") {
    db = checkCancel(
      await select<RelationalDbChoice>({
        message: "Database (Drizzle)",
        options: DRIZZLE_DB_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          hint: o.value === "postgresql" ? "default" : undefined,
        })),
      })
    );
  }

  return { ds, db };
}

export async function runPrompts(): Promise<ScaffoldConfig> {
  intro("create-app  —  scaffold from coding-templates  (v0.1.0-alpha.1)");

  // 1. Project name
  const projectName = checkCancel(
    await text({
      message: "Project name",
      placeholder: "my-app",
      validate: (v) => {
        if (!v) return "Project name is required";
        if (!/^[a-z][a-z0-9-]*$/.test(v))
          return "Use lowercase letters, numbers, and hyphens only (must start with a letter)";
      },
    })
  );

  // 2. Org scope
  const orgScope = checkCancel(
    await text({
      message: "Organisation scope (without @)",
      placeholder: "myorg",
      validate: (v) => {
        if (!v) return "Scope is required";
        if (!/^[a-z][a-z0-9-]*$/.test(v))
          return "Use lowercase letters, numbers, and hyphens only";
      },
    })
  );

  // 3. Scaffold target
  const scaffoldTarget = checkCancel(
    await select<ScaffoldTarget>({
      message: "What are you scaffolding?",
      options: [
        { value: "ui-ds",   label: "Full-stack  —  UI + DS (GraphQL Yoga + chosen storage)" },
        { value: "ds-only", label: "DS only  —  GraphQL Yoga backend" },
        { value: "ui-only", label: "UI only  —  Next.js frontend (connects to an external DS)" },
      ],
    })
  );

  // 4. Output directory
  const rawOutputDir = checkCancel(
    await text({
      message: "Output directory",
      initialValue: `./${projectName}`,
      validate: (v) => {
        if (!v) return "Output directory is required";
      },
    })
  );

  const outputDir = path.resolve(rawOutputDir);
  await checkOutputDir(outputDir);

  // 5. Storage + DB (DS only / Full-stack)
  let ds: DsChoice = "none";
  let db: DbChoice | null = null;
  let ui: UiChoice = "none";

  if (scaffoldTarget !== "ui-only") {
    ({ ds, db } = await promptStorageAndDb());
  }

  // 6. UI selection
  if (scaffoldTarget === "ui-only") {
    // Both variants available — no DS compatibility filtering needed
    ui = checkCancel(
      await select<UiChoice>({
        message: "UI",
        options: [
          { value: "standard", label: "Standard UI  —  Next.js + Apollo Client" },
          { value: "hprt",     label: "HPRT UI  —  Next.js + urql + Graphcache" },
        ],
      })
    );
  } else if (scaffoldTarget === "ui-ds") {
    // Filter UI options by DS compatibility
    const uiOptions: { value: UiChoice; label: string }[] = [];

    // Standard UI: available with none, standard (prisma), cdb, mongo, ddb, file
    if (ds !== "hprt") {
      uiOptions.push({ value: "standard", label: "Standard UI  —  Next.js + Apollo Client" });
    }
    // HPRT UI: available with none, hprt (drizzle), cdb, mongo, ddb, file
    if (ds !== "standard") {
      uiOptions.push({ value: "hprt", label: "HPRT UI  —  Next.js + urql + Graphcache" });
    }

    ui = checkCancel(
      await select<UiChoice>({
        message: "UI",
        options: uiOptions,
      })
    );
  }
  // ds-only: ui stays "none"

  // 7. External SDK (UI-only mode, no storage)
  const externalSdkPackage = await promptExternalSdk(ui, ds);

  // 8 & 9. Env + git
  const generateEnv = checkCancel(
    await confirm({
      message: "Generate .env files from .env.example?",
      initialValue: true,
    })
  );

  const initGit = checkCancel(
    await confirm({
      message: "Initialise git repository?",
      initialValue: true,
    })
  );

  // Resolve final package set
  const selectedPackages = resolvePackages(ds, ui);
  const projectType = ds === "none" && ui !== "none" ? "standalone" : "monorepo";

  // Summary
  const pkgList =
    selectedPackages.size > 0
      ? [...selectedPackages].map((id) => `  • ${id}`).join("\n")
      : "  (none — bare project)";
  note(
    `Project:  @${orgScope}/${projectName}\n` +
      `Type:     ${projectType}\n` +
      `Output:   ${outputDir}\n` +
      (db ? `Database: ${db}\n` : "") +
      `\nPackages:\n${pkgList}`,
    "Configuration summary"
  );

  return {
    projectName,
    orgScope,
    outputDir,
    ds,
    db,
    ui,
    externalSdkPackage,
    projectType,
    selectedPackages,
    generateEnv,
    initGit,
  };
}
