import type { PackageId, DsChoice, UiChoice, RelationalDbChoice } from "./types.js";

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
  "ds-mongo": {
    id: "ds-mongo",
    dirName: "ds-mongo",
    label: "ds-mongo (GraphQL Yoga + MongoDB native SDK + Zod)",
    requires: ["ds-sdk-mongo"],
    builtDeps: [],
  },
  "ds-sdk-mongo": {
    id: "ds-sdk-mongo",
    dirName: "ds-sdk-mongo",
    label: "ds-sdk-mongo (TypedDocumentNode SDK for ds-mongo)",
    requires: [],
    builtDeps: [],
  },
  "ds-ddb": {
    id: "ds-ddb",
    dirName: "ds-ddb",
    label: "ds-ddb (GraphQL Yoga + DocumentDB native SDK + Zod)",
    requires: ["ds-sdk-ddb"],
    builtDeps: [],
  },
  "ds-sdk-ddb": {
    id: "ds-sdk-ddb",
    dirName: "ds-sdk-ddb",
    label: "ds-sdk-ddb (TypedDocumentNode SDK for ds-ddb)",
    requires: [],
    builtDeps: [],
  },
  "ds-file": {
    id: "ds-file",
    dirName: "ds-file",
    label: "ds-file (GraphQL Yoga + JSON/YAML file storage + Zod)",
    requires: ["ds-sdk-file"],
    builtDeps: [],
  },
  "ds-sdk-file": {
    id: "ds-sdk-file",
    dirName: "ds-sdk-file",
    label: "ds-sdk-file (TypedDocumentNode SDK for ds-file)",
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
  } else if (ds === "mongo") {
    selected.add("ds-mongo");
    selected.add("ds-sdk-mongo");
  } else if (ds === "ddb") {
    selected.add("ds-ddb");
    selected.add("ds-sdk-ddb");
  } else if (ds === "file") {
    selected.add("ds-file");
    selected.add("ds-sdk-file");
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

  // For any DS that doesn't follow the standard/hprt SDK pairing,
  // remap the UI's SDK dependency to the correct SDK package.
  const sdkRemap: Partial<Record<DsChoice, PackageId>> = {
    cdb: "ds-sdk-cdb",
    mongo: "ds-sdk-mongo",
    ddb: "ds-sdk-ddb",
    file: "ds-sdk-file",
  };

  const newPkg = sdkRemap[ds];
  if (newPkg) {
    const oldPkg = ui === "standard" ? "@corpdk/ds-sdk" : "@corpdk/ds-sdk-hprt";
    return { oldPkg, newPkg };
  }

  // Standard DS + Standard UI → ds-sdk (normal, no remapping needed)
  // HPRT DS + HPRT UI → ds-sdk-hprt (normal, no remapping needed)
  return null;
}

/** Relational DB options for Prisma (no MongoDB — belongs in Document DB) */
export const PRISMA_DB_OPTIONS: { value: RelationalDbChoice; label: string }[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "cockroachdb", label: "CockroachDB" },
];

/** Relational DB options for Drizzle */
export const DRIZZLE_DB_OPTIONS: { value: RelationalDbChoice; label: string }[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "cockroachdb", label: "CockroachDB" },
];
