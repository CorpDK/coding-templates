import { join } from "node:path";
import { loadDalConfig, type DalConfig } from "./config.js";
import { lintFilterIndexCoverage } from "./filter-index-lint.js";
import { hasIndexCoverage } from "./index-coverage.js";
import {
  collectSchemaFiles,
  importSchemaModule,
  loadEntities,
  type EntityModel,
} from "./model.js";

export type { LintSeverity, LintViolation } from "./lint-types.js";
import type { LintSeverity, LintViolation } from "./lint-types.js";

const ENUM_VALUE_RE = /^[A-Z][A-Z0-9_]*$/;

function lintBooleanNaming(entity: EntityModel): LintViolation[] {
  const violations: LintViolation[] = [];
  for (const col of entity.columns) {
    if (col.kind !== "boolean") continue;
    const physical = col.physicalName;
    if (physical.startsWith("is_") || physical.startsWith("has_")) continue;
    violations.push({
      severity: "error",
      code: "BOOLEAN_NAMING",
      message: `Boolean column must use is_* or has_* physical name (got '${physical}')`,
      entity: entity.exportName,
      column: col.drizzleKey,
    });
  }
  return violations;
}

function lintEnumCasing(entity: EntityModel): LintViolation[] {
  const violations: LintViolation[] = [];
  for (const col of entity.columns) {
    if (!col.enumValues?.length) continue;
    for (const value of col.enumValues) {
      if (ENUM_VALUE_RE.test(value)) continue;
      violations.push({
        severity: "error",
        code: "ENUM_CASING",
        message: `Enum value '${value}' must be UPPERCASE or SCREAMING_SNAKE_CASE`,
        entity: entity.exportName,
        column: col.drizzleKey,
      });
    }
  }
  return violations;
}

function lintSoftDeleteShape(entity: EntityModel): LintViolation[] {
  const hasDeletedAt = entity.columns.some((c) => c.drizzleKey === "deletedAt");
  const hasDeletedBy = entity.columns.some((c) => c.drizzleKey === "deletedBy");
  if (!hasDeletedBy || hasDeletedAt) return [];
  return [
    {
      severity: "error",
      code: "SOFT_DELETE_SHAPE",
      message: "deletedBy without deletedAt is invalid",
      entity: entity.exportName,
    },
  ];
}

function lintSortIndexCoverage(
  entity: EntityModel,
  combined: Record<string, unknown>,
  strict: boolean,
): LintViolation[] {
  const indexCheckColumns = strict
    ? entity.columns.filter((c) => c.drizzleKey !== "id")
    : entity.columns.filter((c) => c.drizzleKey === "createdAt" || c.drizzleKey === "updatedAt");
  const severity: LintSeverity = strict ? "error" : "warn";
  const violations: LintViolation[] = [];
  for (const col of indexCheckColumns) {
    const covered = hasIndexCoverage(entity.exportName, col.drizzleKey, combined, {
      leadingOnly: false,
    });
    if (covered) continue;
    violations.push({
      severity,
      code: "SORT_INDEX",
      message: `Sort column '${col.drizzleKey}' has no covering index declared in Drizzle`,
      entity: entity.exportName,
      column: col.drizzleKey,
    });
  }
  return violations;
}

function lintEntityModel(entity: EntityModel, combined: Record<string, unknown>, strict: boolean): LintViolation[] {
  return [
    ...lintBooleanNaming(entity),
    ...lintEnumCasing(entity),
    ...lintSoftDeleteShape(entity),
    ...lintFilterIndexCoverage(entity, combined, strict),
    ...lintSortIndexCoverage(entity, combined, strict),
  ];
}

async function loadSchemaModules(schemaPath: string): Promise<Record<string, unknown>> {
  const combined: Record<string, unknown> = {};
  for (const file of collectSchemaFiles(schemaPath)) {
    const mod = await importSchemaModule(file);
    Object.assign(combined, mod);
  }
  return combined;
}

export interface EntityLintOptions {
  packageRoot: string;
  schemaPath: string;
  configPath: string;
}

export interface EntityLintResult {
  violations: LintViolation[];
  entityCount: number;
}

export async function runEntityLint(options: EntityLintOptions): Promise<EntityLintResult> {
  const config: Required<DalConfig> = loadDalConfig(join(options.packageRoot, options.configPath));
  const schemaPath = join(options.packageRoot, options.schemaPath);
  const violations: LintViolation[] = [];
  let entities: EntityModel[] = [];

  try {
    entities = await loadEntities(schemaPath, config.strict);
  } catch (err) {
    violations.push({
      severity: "error",
      code: "SCHEMA_LOAD",
      message: err instanceof Error ? err.message : String(err),
    });
    return { violations, entityCount: 0 };
  }

  const combined = await loadSchemaModules(schemaPath);
  for (const entity of entities) {
    violations.push(...lintEntityModel(entity, combined, config.strict));
  }

  return { violations, entityCount: entities.length };
}

export function formatLintViolations(violations: LintViolation[]): string {
  if (violations.length === 0) return "entity:lint — no violations";
  return violations
    .map((v) => {
      const loc = [v.entity, v.column].filter(Boolean).join(".");
      const prefix = v.severity === "error" ? "ERROR" : "WARN";
      const locationSuffix = loc ? ` ${loc}:` : "";
      return `${prefix} [${v.code}]${locationSuffix} ${v.message}`;
    })
    .join("\n");
}

export function lintExitCode(violations: LintViolation[]): number {
  return violations.some((v) => v.severity === "error") ? 1 : 0;
}
