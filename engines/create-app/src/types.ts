export type PackageId =
  | "ds"
  | "ds-sdk"
  | "ds-hprt"
  | "ds-cdb"
  | "ds-mongo"
  | "ds-ddb"
  | "ds-file"
  | "ui"
  | "ui-hprt";

export type DsChoice = "none" | "standard" | "hprt" | "cdb" | "mongo" | "ddb" | "file";
export type UiChoice = "none" | "standard" | "hprt";

/** Relational DB choices — used with Prisma (standard) and Drizzle (hprt) */
export type RelationalDbChoice = "postgresql" | "mysql" | "sqlite" | "cockroachdb";
/** Document DB choices when reusing the Prisma/standard template */
export type DocumentDbChoice = "mongodb" | "documentdb";
/** Union of all possible db values stored in ScaffoldConfig */
export type DbChoice = RelationalDbChoice | DocumentDbChoice;

/** Top-level storage category */
export type StorageType = "relational" | "document" | "filebased";
/** ORM selection within Relational DB */
export type OrmChoice = "prisma" | "drizzle";
/** Document DB provider */
export type DocumentProvider = "couchbase" | "mongodb" | "documentdb";
/** Implementation within MongoDB / DocumentDB */
export type DocumentImpl = "standard" | "hprt";

export type ProjectType = "monorepo" | "standalone";
export type ScaffoldTarget = "ui-only" | "ds-only" | "ui-ds";

export interface ScaffoldConfig {
  projectName: string;
  orgScope: string;
  outputDir: string;
  ds: DsChoice;
  db: DbChoice | null;
  ui: UiChoice;
  externalSdkPackage: string | null;
  projectType: ProjectType;
  selectedPackages: Set<PackageId>;
  generateEnv: boolean;
  initGit: boolean;
}
