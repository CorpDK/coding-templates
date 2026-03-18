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
import type { DbChoice, DsChoice, ScaffoldConfig, UiChoice } from "./types.js";
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
      "Since no DS is included, provide the published npm package name\n" +
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

export async function runPrompts(): Promise<ScaffoldConfig> {
  intro("create-app  —  scaffold from coding-templates");

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

  // 3. Output directory
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

  // 4. DS selection
  const ds = checkCancel(
    await select<DsChoice>({
      message: "Data service (DS)",
      options: [
        { value: "none", label: "None" },
        {
          value: "standard",
          label: "Standard  —  GraphQL Yoga + Prisma (PostgreSQL / MySQL / SQLite / CockroachDB / MongoDB)",
        },
        {
          value: "hprt",
          label: "High-Performance Real-Time  —  GraphQL Yoga + Drizzle (PostgreSQL / MySQL / SQLite / CockroachDB)",
        },
        {
          value: "cdb",
          label: "Couchbase  —  GraphQL Yoga + Couchbase + Zod",
        },
      ],
    })
  );

  // 5. DB selection (only for Standard or HPRT)
  let db: DbChoice | null = null;

  if (ds === "standard") {
    db = checkCancel(
      await select<DbChoice>({
        message: "Database (Prisma)",
        options: PRISMA_DB_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          hint: o.value === "postgresql" ? "default" : undefined,
        })),
      })
    );
  } else if (ds === "hprt") {
    db = checkCancel(
      await select<DbChoice>({
        message: "Database (Drizzle)",
        options: DRIZZLE_DB_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          hint: o.value === "postgresql" ? "default" : undefined,
        })),
      })
    );
  }

  // 6. UI selection (options filtered by DS)
  const uiOptions: { value: UiChoice; label: string; hint?: string }[] = [
    { value: "none", label: "None" },
  ];

  if (ds === "none" || ds === "standard" || ds === "cdb") {
    uiOptions.push({
      value: "standard",
      label: "Standard UI  —  Next.js + Apollo Client",
      hint: ds === "cdb" ? "SDK remapped to ds-sdk-cdb" : undefined,
    });
  }

  if (ds === "none" || ds === "hprt" || ds === "cdb") {
    uiOptions.push({
      value: "hprt",
      label: "HPRT UI  —  Next.js + urql + Graphcache",
      hint: ds === "cdb" ? "SDK remapped to ds-sdk-cdb" : undefined,
    });
  }

  const ui = checkCancel(
    await select<UiChoice>({
      message: "UI",
      options: uiOptions,
    })
  );

  // 7. External SDK (UI-only mode, DS = none)
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
  const projectType =
    ds === "none" && ui !== "none" ? "standalone" : "monorepo";

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

