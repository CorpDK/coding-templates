import type { PackageId, DsChoice, UiChoice, DbChoice } from "./types.js";

export interface PackageDef {
  id: PackageId;
  dirName: string;
  label: string;
  /** Packages auto-included when this one is selected */
  requires: PackageId[];
  /** pnpm-workspace.yaml onlyBuiltDependencies entries needed */
  builtDeps: string[];
}

export const PACKAGE_DEFS: Record<PackageId, PackageDef> = {
  ds: {
    id: "ds",
    dirName: "ds",
    label: "ds (GraphQL Yoga + Prisma)",
    requires: ["ds-sdk"],
    builtDeps: ["@prisma/engines", "prisma"],
  },
  "ds-sdk": {
    id: "ds-sdk",
    dirName: "ds-sdk",
    label: "ds-sdk (TypedDocumentNode SDK for ds)",
    requires: [],
    builtDeps: [],
  },
  "ds-hprt": {
    id: "ds-hprt",
    dirName: "ds-hprt",
    label: "ds-hprt (GraphQL Yoga + Drizzle)",
    requires: ["ds-sdk-hprt"],
    builtDeps: [],
  },
  "ds-sdk-hprt": {
    id: "ds-sdk-hprt",
    dirName: "ds-sdk-hprt",
    label: "ds-sdk-hprt (TypedDocumentNode SDK for ds-hprt)",
    requires: [],
    builtDeps: [],
  },
  "ds-cdb": {
    id: "ds-cdb",
    dirName: "ds-cdb",
    label: "ds-cdb (GraphQL Yoga + Couchbase + Zod)",
    requires: ["ds-sdk-cdb"],
    builtDeps: ["couchbase"],
  },
  "ds-sdk-cdb": {
    id: "ds-sdk-cdb",
    dirName: "ds-sdk-cdb",
    label: "ds-sdk-cdb (TypedDocumentNode SDK for ds-cdb)",
    requires: [],
    builtDeps: [],
  },
  ui: {
    id: "ui",
    dirName: "ui",
    label: "ui (Next.js + Apollo Client)",
    requires: [],
    builtDeps: [],
  },
  "ui-hprt": {
    id: "ui-hprt",
    dirName: "ui-hprt",
    label: "ui-hprt (Next.js + urql + Graphcache)",
    requires: [],
    builtDeps: [],
  },
};

/** Resolve packages to include based on DS + UI selections */
export function resolvePackages(ds: DsChoice, ui: UiChoice): Set<PackageId> {
  const selected = new Set<PackageId>();

  if (ds === "standard") {
    selected.add("ds");
    selected.add("ds-sdk");
  } else if (ds === "hprt") {
    selected.add("ds-hprt");
    selected.add("ds-sdk-hprt");
  } else if (ds === "cdb") {
    selected.add("ds-cdb");
    selected.add("ds-sdk-cdb");
  }

  if (ui === "standard") {
    selected.add("ui");
  } else if (ui === "hprt") {
    selected.add("ui-hprt");
  }

  return selected;
}

/** Compute pnpm-workspace.yaml onlyBuiltDependencies for selected packages */
export function getBuiltDeps(selected: Set<PackageId>): string[] {
  const all = new Set<string>(["esbuild"]);
  for (const id of selected) {
    for (const dep of PACKAGE_DEFS[id].builtDeps) {
      all.add(dep);
    }
  }
  return [...all].sort((a, b) => a.localeCompare(b));
}

/** Which SDK package the UI depends on, given DS and UI choices */
export function resolveUiSdkDep(
  ds: DsChoice,
  ui: UiChoice
): { oldPkg: string; newPkg: PackageId } | null {
  if (ui === "none") return null;

  if (ds === "cdb") {
    // CDB pairs with either UI, but SDK is always ds-sdk-cdb
    const oldPkg = ui === "standard" ? "@corpdk/ds-sdk" : "@corpdk/ds-sdk-hprt";
    return { oldPkg, newPkg: "ds-sdk-cdb" };
  }

  // Standard DS + Standard UI → ds-sdk (normal, no remapping needed)
  // HPRT DS + HPRT UI → ds-sdk-hprt (normal, no remapping needed)
  return null;
}

/** DB options per DS variant */
export const PRISMA_DB_OPTIONS: { value: DbChoice; label: string }[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "cockroachdb", label: "CockroachDB" },
  { value: "mongodb", label: "MongoDB" },
];

export const DRIZZLE_DB_OPTIONS: { value: DbChoice; label: string }[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "cockroachdb", label: "CockroachDB" },
];
