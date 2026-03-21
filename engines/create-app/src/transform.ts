import type { DbChoice, DsChoice, UiChoice } from "./types.js";

// ---------------------------------------------------------------------------
// Note on DocumentDbChoice values ("mongodb", "documentdb"):
// These reach Prisma transforms only when Document DB + Standard (Prisma) is
// selected — deriveDsChoice sets ds="standard" with db="mongodb"|"documentdb".
// Drizzle transforms never receive these values.
// ---------------------------------------------------------------------------

/** Replace @corpdk/ scope with the user's org scope in all text content */
export function transformScope(content: string, orgScope: string): string {
  return content.replaceAll("@corpdk/", `@${orgScope}/`);
}

/** Replace the root package name in root package.json */
export function transformRootPackageName(
  content: string,
  projectName: string,
  orgScope: string
): string {
  return content.replace(
    /"name":\s*"@corpdk\/coding-templates"/,
    `"name": "@${orgScope}/${projectName}"`
  );
}

// ---------------------------------------------------------------------------
// Prisma DB transformations
// ---------------------------------------------------------------------------

const PRISMA_PROVIDER: Record<DbChoice, string> = {
  postgresql: "postgresql",
  mysql: "mysql",
  sqlite: "sqlite",
  cockroachdb: "cockroachdb",
  mongodb: "mongodb",
  documentdb: "mongodb", // DocumentDB uses MongoDB connector
};

const PRISMA_DATABASE_URL: Record<DbChoice, string> = {
  postgresql: "postgresql://user:pass@localhost:5432/dbname",
  mysql: "mysql://user:pass@localhost:3306/dbname",
  sqlite: "file:./dev.db",
  cockroachdb: "postgresql://user:pass@localhost:26257/defaultdb",
  mongodb: "mongodb://user:pass@localhost:27017/dbname",
  documentdb: "mongodb://user:pass@localhost:27017/dbname?tls=true&tlsCAFile=/path/to/ca.pem",
};

export function transformPrismaSchema(content: string, db: DbChoice): string {
  return content.replace(
    /provider = "postgresql"/,
    `provider = "${PRISMA_PROVIDER[db]}"`
  );
}

export function transformPrismaDotEnv(content: string, db: DbChoice): string {
  return content.replace(
    /DATABASE_URL=postgresql:\/\/.*$/m,
    `DATABASE_URL=${PRISMA_DATABASE_URL[db]}`
  );
}

// ---------------------------------------------------------------------------
// Drizzle DB transformations
// ---------------------------------------------------------------------------

type DrizzleDialect = "postgresql" | "mysql" | "sqlite";

const DRIZZLE_DIALECT: Record<DbChoice, DrizzleDialect> = {
  postgresql: "postgresql",
  mysql: "mysql",
  sqlite: "sqlite",
  cockroachdb: "postgresql",
  mongodb: "postgresql",    // should not happen for drizzle
  documentdb: "postgresql", // should not happen for drizzle
};

const DRIZZLE_DATABASE_URL: Record<DbChoice, string> = {
  postgresql: "postgresql://user:pass@localhost:5432/dbname",
  mysql: "mysql://user:pass@localhost:3306/dbname",
  sqlite: "file:./dev.db",
  cockroachdb: "postgresql://user:pass@localhost:26257/defaultdb",
  mongodb: "postgresql://user:pass@localhost:5432/dbname",    // should not happen
  documentdb: "postgresql://user:pass@localhost:5432/dbname", // should not happen
};

// Map: db → { schemaImport, tableFunc, driver }
const DRIZZLE_SCHEMA_MAP: Record<
  DbChoice,
  { module: string; tableFunc: string; importedNames: string[] }
> = {
  postgresql: {
    module: "drizzle-orm/pg-core",
    tableFunc: "pgTable",
    importedNames: ["boolean", "integer", "pgTable", "text", "varchar"],
  },
  mysql: {
    module: "drizzle-orm/mysql-core",
    tableFunc: "mysqlTable",
    importedNames: ["boolean", "int", "mysqlTable", "text", "varchar"],
  },
  sqlite: {
    module: "drizzle-orm/sqlite-core",
    tableFunc: "sqliteTable",
    importedNames: ["integer", "sqliteTable", "text"],
  },
  cockroachdb: {
    module: "drizzle-orm/pg-core",
    tableFunc: "pgTable",
    importedNames: ["boolean", "integer", "pgTable", "text", "varchar"],
  },
  // Should not happen for drizzle — included for exhaustive Record typing
  mongodb: {
    module: "drizzle-orm/pg-core",
    tableFunc: "pgTable",
    importedNames: ["boolean", "integer", "pgTable", "text", "varchar"],
  },
  documentdb: {
    module: "drizzle-orm/pg-core",
    tableFunc: "pgTable",
    importedNames: ["boolean", "integer", "pgTable", "text", "varchar"],
  },
};

// Drizzle driver dependency per DB
const DRIZZLE_DRIVER_DEP: Record<DbChoice, string> = {
  postgresql: "pg",
  mysql: "mysql2",
  sqlite: "better-sqlite3",
  cockroachdb: "pg",
  mongodb: "pg",    // should not happen for drizzle
  documentdb: "pg", // should not happen for drizzle
};

const DRIZZLE_DRIVER_TYPE_DEP: Record<DbChoice, string | null> = {
  postgresql: "@types/pg",
  mysql: null,
  sqlite: "@types/better-sqlite3",
  cockroachdb: "@types/pg",
  mongodb: "@types/pg",    // should not happen for drizzle
  documentdb: "@types/pg", // should not happen for drizzle
};

export function transformDrizzleConfig(content: string, db: DbChoice): string {
  const dialect = DRIZZLE_DIALECT[db];
  let result = content.replace(/dialect: "postgresql"/, `dialect: "${dialect}"`);

  // For SQLite, dbCredentials uses a file path, not url
  if (db === "sqlite") {
    result = result.replace(
      /dbCredentials:\s*\{\s*url: process\.env\.DS_HPRT_DATABASE_URL!,\s*\}/,
      `dbCredentials: {\n    url: process.env.DS_HPRT_DATABASE_URL!,\n  }`
    );
  }

  return result;
}

export function transformDrizzleSchema(content: string, db: DbChoice): string {
  const map = DRIZZLE_SCHEMA_MAP[db];

  let result = content;

  // Replace import line
  result = result.replace(
    /import \{[^}]+\} from "drizzle-orm\/pg-core";/,
    `import { ${map.importedNames.join(", ")} } from "${map.module}";`
  );

  // Replace pgTable with the correct table function
  result = result.replaceAll("pgTable", map.tableFunc);

  // For MySQL: replace integer() with int(), boolean() → boolean() (keep), varchar → varchar
  if (db === "mysql") {
    result = result.replace(/integer\(\)\.primaryKey\(\)\.generatedAlwaysAsIdentity\(\)/, "int().primaryKey().autoincrement()");
  }

  // For SQLite: replace integer().generatedAlwaysAsIdentity() with integer().primaryKey({ autoIncrement: true })
  if (db === "sqlite") {
    result = result.replace(
      /integer\(\)\.primaryKey\(\)\.generatedAlwaysAsIdentity\(\)/,
      "integer().primaryKey({ autoIncrement: true })"
    );
    // SQLite text() for boolean
    result = result.replace(/boolean\(\)\.default\(true\)/, "integer({ mode: 'boolean' }).default(1)");
  }

  return result;
}

export function transformDrizzlePackageJson(
  content: string,
  db: DbChoice
): string {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const deps = parsed["dependencies"] as Record<string, string>;
  const devDeps = parsed["devDependencies"] as Record<string, string>;

  // Remove old pg dep
  const oldDriver = "pg";
  const oldTypeDep = "@types/pg";
  const newDriver = DRIZZLE_DRIVER_DEP[db];
  const newTypeDep = DRIZZLE_DRIVER_TYPE_DEP[db];

  if (newDriver !== oldDriver) {
    const pgVersion = deps[oldDriver];
    delete deps[oldDriver];
    deps[newDriver] = newDriver === "pg" ? pgVersion : "latest";
  }

  if (devDeps[oldTypeDep] !== undefined) {
    const oldTypeVersion = devDeps[oldTypeDep];
    delete devDeps[oldTypeDep];
    if (newTypeDep) {
      devDeps[newTypeDep] = oldTypeVersion;
    }
  }

  return JSON.stringify(parsed, null, 2) + "\n";
}

export function transformDrizzleDotEnv(content: string, db: DbChoice): string {
  return content.replace(
    /DS_HPRT_DATABASE_URL=postgresql:\/\/.*$/m,
    `DS_HPRT_DATABASE_URL=${DRIZZLE_DATABASE_URL[db]}`
  );
}

// ---------------------------------------------------------------------------
// SDK remapping for standalone UI-only mode
// ---------------------------------------------------------------------------

/**
 * Remap SDK imports in UI source files when an external SDK is substituted.
 */
export function transformUiSdkImport(
  content: string,
  oldSdkPkg: string,
  newSdkPkg: string
): string {
  return content.replaceAll(oldSdkPkg, newSdkPkg);
}

/**
 * Replace workspace:* SDK dep with external npm package (UI-only standalone mode).
 */
export function transformExternalSdk(
  content: string,
  oldSdkPkg: string,
  externalPkg: string,
  externalVersion: string
): string {
  return content.replace(
    new RegExp(String.raw`"${escapeRegex(oldSdkPkg)}":\s*"workspace:\*"`),
    `"${externalPkg}": "${externalVersion}"`
  );
}

function escapeRegex(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

// ---------------------------------------------------------------------------
// Orchestrated per-file transform
// ---------------------------------------------------------------------------

export interface TransformContext {
  orgScope: string;
  ds: DsChoice;
  ui: UiChoice;
  db: DbChoice | null;
  /** For standalone UI-only: external SDK package info */
  externalSdk: { oldPkg: string; externalPkg: string; version: string } | null;
  isRootPackageJson: boolean;
  projectName: string;
}

function applyPrismaTransforms(result: string, relPath: string, db: DbChoice): string {
  if (relPath.endsWith("schema.prisma")) {
    result = transformPrismaSchema(result, db);
  }
  if (relPath === ".env" || relPath === ".env.example") {
    result = transformPrismaDotEnv(result, db);
  }
  return result;
}

function applyDrizzleTransforms(result: string, relPath: string, db: DbChoice): string {
  if (relPath.endsWith("drizzle.config.ts")) {
    result = transformDrizzleConfig(result, db);
  }
  if (relPath.endsWith("drizzle/schema.ts") || relPath.includes("drizzle" + "/" + "schema.ts")) {
    result = transformDrizzleSchema(result, db);
  }
  if (relPath === ".env" || relPath === ".env.example") {
    result = transformDrizzleDotEnv(result, db);
  }
  // package.json driver swap handled separately in scaffold.ts after full JSON transform
  return result;
}

export function transformFileContent(
  content: string,
  relPath: string,
  ctx: TransformContext
): string {
  let result = content;

  // 1. Scope rename (always)
  result = transformScope(result, ctx.orgScope);

  // 2. Root package.json name
  if (ctx.isRootPackageJson) {
    result = transformRootPackageName(result, ctx.projectName, ctx.orgScope);
  }

  // 3. Prisma transformations
  if (ctx.ds === "standard" && ctx.db) {
    result = applyPrismaTransforms(result, relPath, ctx.db);
  }

  // 4. Drizzle transformations
  if (ctx.ds === "hprt" && ctx.db) {
    result = applyDrizzleTransforms(result, relPath, ctx.db);
  }

  // 5. External SDK (standalone UI-only)
  if (ctx.externalSdk) {
    const renamedOldPkg = ctx.externalSdk.oldPkg.replace("@corpdk/", `@${ctx.orgScope}/`);
    if (relPath === "package.json") {
      result = transformExternalSdk(
        result,
        renamedOldPkg,
        ctx.externalSdk.externalPkg,
        ctx.externalSdk.version
      );
    } else {
      result = transformUiSdkImport(result, renamedOldPkg, ctx.externalSdk.externalPkg);
    }
  }

  return result;
}
