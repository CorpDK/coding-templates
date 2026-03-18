export type PackageId =
  | "ds"
  | "ds-sdk"
  | "ds-hprt"
  | "ds-sdk-hprt"
  | "ds-cdb"
  | "ds-sdk-cdb"
  | "ui"
  | "ui-hprt";

export type DsChoice = "none" | "standard" | "hprt" | "cdb";
export type UiChoice = "none" | "standard" | "hprt";
export type DbChoice =
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "cockroachdb"
  | "mongodb";

export type ProjectType = "monorepo" | "standalone";

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
