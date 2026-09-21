import { join } from "node:path";
import { loadDalConfig, type DalConfig } from "./config.js";
import { lintFilterIndexCoverage } from "./filter-index-lint.js";
import { hasIndexCoverage } from "./index-coverage.js";
import { collectSchemaFiles, importSchemaModule } from "./model.js";
import type { EntityModel } from "./model.js";
import { loadEntities } from "./model.js";

export type { LintSeverity, LintViolation } from "./lint-types.js";
import type { LintSeverity, LintViolation } from "./lint-types.js";

const ENUM_VALUE_RE = /^[A-Z][A-Z0-9_]*$/;

function lintEntityModel(entity: EntityModel, combined: Record<string, unknown>, strict: boolean): LintViolation[] {
  const violations: LintViolation[] = [];

  for (const col of entity.columns) {
    if (col.kind === "boolean") {
      const physical = col.physicalName;
      if (!physical.startsWith("is_") && !physical.startsWith("has_")) {
        violations.push({
          severity: "error",
          code: "BOOLEAN_NAMING",
          message: `Boolean column must use is_* or has_* physical name (got '${physical}')`,
          entity: entity.exportName,
          column: col.drizzleKey,
        });
      }
    }

    if (col.enumValues?.length) {
      for (const value of col.enumValues) {
        if (!ENUM_VALUE_RE.test(value)) {
          violations.push({
            severity: "error",
            code: "ENUM_CASING",
            message: `Enum value '${value}' must be UPPERCASE or SCREAMING_SNAKE_CASE`,
            entity: entity.exportName,
            column: col.drizzleKey,
          });
        }
      }
    }
  }

  const hasDeletedAt = entity.columns.some((c) => c.drizzleKey === "deletedAt");
  const hasDeletedBy = entity.columns.some((c) => c.drizzleKey === "deletedBy");
  if (hasDeletedBy && !hasDeletedAt) {
    violations.push({
      severity: "error",
      code: "SOFT_DELETE_SHAPE",
      message: "deletedBy without deletedAt is invalid",
      entity: entity.exportName,
    });
  }

  const indexCheckColumns = strict
    ? entity.columns.filter((c) => c.drizzleKey !== "id")
    : entity.columns.filter((c) => c.drizzleKey === "createdAt" || c.drizzleKey === "updatedAt");

  violations.push(...lintFilterIndexCoverage(entity, combined, strict));

  for (const col of indexCheckColumns) {
    const covered = hasIndexCoverage(entity.exportName, col.drizzleKey, combined, {
      leadingOnly: false,
    });
    if (covered) continue;
    const severity: LintSeverity = strict ? "error" : "warn";
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
      return `${prefix} [${v.code}]${loc ? ` ${loc}:` : ""} ${v.message}`;
    })
    .join("\n");
}

export function lintExitCode(violations: LintViolation[]): number {
  return violations.some((v) => v.severity === "error") ? 1 : 0;
}
