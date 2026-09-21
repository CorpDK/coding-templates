import type { EntityModel } from "./model.js";
import type { LintSeverity, LintViolation } from "./lint-types.js";
import { filterableColumns } from "./generators/schema-utils.js";
import { hasIndexCoverage } from "./index-coverage.js";

export interface FilterIndexTarget {
  tableExport: string;
  drizzleKey: string;
}

/** Columns that need filter/association index coverage per §17.1 v2. */
export function collectFilterIndexTargets(entity: EntityModel): FilterIndexTarget[] {
  const targets: FilterIndexTarget[] = [];
  const seen = new Set<string>();

  const add = (tableExport: string, drizzleKey: string): void => {
    const key = `${tableExport}.${drizzleKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ tableExport, drizzleKey });
  };

  for (const col of filterableColumns(entity)) {
    if (col.drizzleKey === "id") continue;
    add(entity.exportName, col.drizzleKey);
  }

  for (const rel of entity.relations) {
    if (!rel.filterable) continue;

    if (rel.ownerFkDrizzleKey) {
      add(entity.exportName, rel.ownerFkDrizzleKey);
    }

    if (rel.kind === "one-to-many" && rel.childFkDrizzleKey) {
      add(rel.targetExportName, rel.childFkDrizzleKey);
    }

    if (rel.kind === "many-to-many" && rel.joinTableExportName) {
      if (rel.joinOwnerFkDrizzleKey) {
        add(rel.joinTableExportName, rel.joinOwnerFkDrizzleKey);
      }
      if (rel.joinTargetFkDrizzleKey) {
        add(rel.joinTableExportName, rel.joinTargetFkDrizzleKey);
      }
    }
  }

  return targets;
}

export function lintFilterIndexCoverage(
  entity: EntityModel,
  combined: Record<string, unknown>,
  strict: boolean,
): LintViolation[] {
  const violations: LintViolation[] = [];
  const severity: LintSeverity = strict ? "error" : "warn";

  for (const { tableExport, drizzleKey } of collectFilterIndexTargets(entity)) {
    const covered = hasIndexCoverage(tableExport, drizzleKey, combined, { leadingOnly: true });
    if (covered) continue;

    const onEntity = tableExport === entity.exportName;
    violations.push({
      severity,
      code: "FILTER_INDEX",
      message: `Filter column '${drizzleKey}' has no covering index (single-column or leading composite) declared in Drizzle`,
      entity: onEntity ? entity.exportName : tableExport,
      column: drizzleKey,
    });
  }

  return violations;
}
