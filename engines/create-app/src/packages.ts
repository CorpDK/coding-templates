import type { PackageId, DsChoice, UiChoice, RelationalDbChoice } from "./types.js";

export interface PackageDef {
  id: PackageId;
  dirName: string;
  label: string;
  /** Packages auto-included when this one is selected */
  requires: PackageId[];
  /** pnpm-workspace.yaml onlyBuiltDependencies entries needed */
  builtDeps: string[];
  /** Where the source directory lives in the template root */
  sourceBase: "templates" | "packages";
}

export const PACKAGE_DEFS: Record<PackageId, PackageDef> = {
  ds: {
    id: "ds",
    dirName: "ds",
    label: "ds (GraphQL Yoga + Prisma)",
    requires: ["ds-sdk"],
    builtDeps: ["@prisma/engines", "prisma"],
    sourceBase: "templates",
  },
  "ds-sdk": {
    id: "ds-sdk",
    dirName: "ds-sdk",
    label: "ds-sdk (TypedDocumentNode SDK)",
    requires: [],
    builtDeps: [],
    sourceBase: "templates",
  },
  "ds-hprt": {
    id: "ds-hprt",
    dirName: "ds-hprt",
    label: "ds-hprt (GraphQL Yoga + Drizzle)",
    requires: ["ds-sdk"],
    builtDeps: [],
    sourceBase: "templates",
  },
  "ds-cdb": {
    id: "ds-cdb",
    dirName: "ds-cdb",
    label: "ds-cdb (GraphQL Yoga + Couchbase + Zod)",
    requires: ["ds-sdk"],
    builtDeps: ["couchbase"],
    sourceBase: "templates",
  },
  "ds-mongo": {
    id: "ds-mongo",
    dirName: "ds-mongo",
    label: "ds-mongo (GraphQL Yoga + MongoDB native SDK + Zod)",
    requires: ["ds-sdk"],
    builtDeps: [],
    sourceBase: "templates",
  },
  "ds-ddb": {
    id: "ds-ddb",
    dirName: "ds-ddb",
    label: "ds-ddb (GraphQL Yoga + DocumentDB native SDK + Zod)",
    requires: ["ds-sdk"],
    builtDeps: [],
    sourceBase: "templates",
  },
  "ds-file": {
    id: "ds-file",
    dirName: "ds-file",
    label: "ds-file (GraphQL Yoga + JSON/YAML file storage + Zod)",
    requires: ["ds-sdk"],
    builtDeps: [],
    sourceBase: "templates",
  },
  ui: {
    id: "ui",
    dirName: "ui",
    label: "ui (Next.js + Apollo Client)",
    requires: [],
    builtDeps: [],
    sourceBase: "templates",
  },
  "ui-hprt": {
    id: "ui-hprt",
    dirName: "ui-hprt",
    label: "ui-hprt (Next.js + urql + Graphcache)",
    requires: [],
    builtDeps: [],
    sourceBase: "templates",
  },
  "ui-core": {
    id: "ui-core",
    dirName: "ui-core",
    label: "ui-core (Design system + primitives)",
    requires: [],
    builtDeps: [],
    sourceBase: "packages",
  },
  "ui-feedback": {
    id: "ui-feedback",
    dirName: "ui-feedback",
    label: "ui-feedback (Toast, ErrorBoundary)",
    requires: ["ui-core"],
    builtDeps: [],
    sourceBase: "packages",
  },
  "ui-forms": {
    id: "ui-forms",
    dirName: "ui-forms",
    label: "ui-forms (React Hook Form + Zod)",
    requires: ["ui-core"],
    builtDeps: [],
    sourceBase: "packages",
  },
  "ui-datagrid": {
    id: "ui-datagrid",
    dirName: "ui-datagrid",
    label: "ui-datagrid (TanStack Table + virtualization)",
    requires: ["ui-core"],
    builtDeps: [],
    sourceBase: "packages",
  },
  "ui-charts": {
    id: "ui-charts",
    dirName: "ui-charts",
    label: "ui-charts (D3.js charts)",
    requires: ["ui-core"],
    builtDeps: [],
    sourceBase: "packages",
  },
  "ui-auth": {
    id: "ui-auth",
    dirName: "ui-auth",
    label: "ui-auth (Auth UI components + BFF OAuth2/OIDC scaffold)",
    requires: ["ui-core"],
    builtDeps: [],
    sourceBase: "packages",
  },
};

/** Resolve packages to include based on DS + UI selections */
export function resolvePackages(
  ds: DsChoice,
  ui: UiChoice,
  optionalUiPackages: PackageId[]
): Set<PackageId> {
  const selected = new Set<PackageId>();

  if (ds === "standard") {
    selected.add("ds");
    selected.add("ds-sdk");
  } else if (ds === "hprt") {
    selected.add("ds-hprt");
    selected.add("ds-sdk");
  } else if (ds === "cdb") {
    selected.add("ds-cdb");
    selected.add("ds-sdk");
  } else if (ds === "mongo") {
    selected.add("ds-mongo");
    selected.add("ds-sdk");
  } else if (ds === "ddb") {
    selected.add("ds-ddb");
    selected.add("ds-sdk");
  } else if (ds === "file") {
    selected.add("ds-file");
    selected.add("ds-sdk");
  }

  if (ui === "standard") {
    selected.add("ui");
    selected.add("ui-core");
    selected.add("ui-feedback");
    for (const pkg of optionalUiPackages) selected.add(pkg);
  } else if (ui === "hprt") {
    selected.add("ui-hprt");
    selected.add("ui-core");
    selected.add("ui-feedback");
    for (const pkg of optionalUiPackages) selected.add(pkg);
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
