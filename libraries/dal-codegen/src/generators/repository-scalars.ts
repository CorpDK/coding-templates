import type { ColumnModel, EntityModel } from "../model.js";
import { businessColumnsWithConstraints, internalRecordColumns } from "./schema-utils.js";

const PARSE_BY_KIND: Partial<Record<ColumnModel["kind"], string>> = {
  timestamptz: "parseDateTime",
  date: "parseDate",
  timetz: "parseTimeTz",
  bigint: "parseBigInt",
  decimal: "parseDecimal",
  interval: "parseIntervalMs",
};

const SERIALIZE_BY_KIND: Partial<Record<ColumnModel["kind"], string>> = {
  timestamptz: "serializeDateTime",
  date: "serializeDate",
  timetz: "serializeTimeTz",
  bigint: "serializeBigInt",
  decimal: "serializeDecimal",
  interval: "serializeIntervalMs",
};

const WIRE_SCALAR_KINDS = new Set<ColumnModel["kind"]>([
  "timestamptz",
  "date",
  "timetz",
  "bigint",
  "decimal",
  "interval",
]);

export function tsTypeForColumn(col: ColumnModel): string {
  if (col.kind === "boolean") return "boolean";
  if (col.kind === "smallint" || col.kind === "integer" || col.kind === "float") return "number";
  if (col.kind === "enum" && col.enumValues?.length) {
    return col.enumValues.map((value) => JSON.stringify(value)).join(" | ");
  }
  return "string";
}

export function collectScalarImports(entity: EntityModel): string[] {
  const names = new Set<string>(["parseDateTime", "serializeDateTime"]);
  for (const col of internalRecordColumns(entity)) {
    const parse = PARSE_BY_KIND[col.kind];
    const ser = SERIALIZE_BY_KIND[col.kind];
    if (parse) names.add(parse);
    if (ser) names.add(ser);
  }
  return [...names].sort();
}

export function inputRef(col: ColumnModel): string {
  if (col.defaultValue !== undefined) {
    return `input.${col.graphqlName} ?? ${JSON.stringify(col.defaultValue)}`;
  }
  return `input.${col.graphqlName}`;
}

function parseWrapper(col: ColumnModel, ref: string, nullable: boolean): string {
  const fn = PARSE_BY_KIND[col.kind];
  if (!fn) return ref;
  if (nullable) {
    return `${ref} === null || ${ref} === undefined ? ${ref} : ${fn}(${ref})`;
  }
  return `${ref} ? ${fn}(${ref}) : undefined`;
}

export function assignCreateValue(col: ColumnModel): string {
  const ref = inputRef(col);
  if (col.kind === "enum") {
    return `      ${col.drizzleKey}: (${ref}) as (typeof table.$inferInsert)["${col.drizzleKey}"],`;
  }
  if (PARSE_BY_KIND[col.kind]) {
    const expr = parseWrapper(col, ref, !col.notNull);
    return `      ${col.drizzleKey}: ${expr},`;
  }
  return `      ${col.drizzleKey}: ${ref},`;
}

export function assignUpdateValue(col: ColumnModel): string {
  if (PARSE_BY_KIND[col.kind]) {
    const fn = PARSE_BY_KIND[col.kind]!;
    if (col.notNull) {
      return `    if (input.${col.graphqlName} !== undefined && input.${col.graphqlName} !== null) {
      set.${col.drizzleKey} = ${fn}(input.${col.graphqlName});
    }`;
    }
    return `    if (input.${col.graphqlName} !== undefined) {
      set.${col.drizzleKey} = input.${col.graphqlName} === null ? null : ${fn}(input.${col.graphqlName});
    }`;
  }
  if (col.kind === "enum") {
    return `    if (input.${col.graphqlName} !== undefined) {
      set.${col.drizzleKey} = input.${col.graphqlName} as (typeof table.$inferInsert)["${col.drizzleKey}"];
    }`;
  }
  return `    if (input.${col.graphqlName} !== undefined) {
    set.${col.drizzleKey} = input.${col.graphqlName};
  }`;
}

export function mapRowFieldLine(col: ColumnModel): string {
  const ser = SERIALIZE_BY_KIND[col.kind];
  if (!ser) {
    return `    ${col.graphqlName}: row.${col.drizzleKey},`;
  }
  if (col.notNull) {
    return `    ${col.graphqlName}: ${ser}(row.${col.drizzleKey})!,`;
  }
  return `    ${col.graphqlName}: row.${col.drizzleKey} != null ? ${ser}(row.${col.drizzleKey}) : null,`;
}

export function cursorWireKinds(entity: EntityModel): ColumnModel[] {
  return internalRecordColumns(entity).filter((c) => WIRE_SCALAR_KINDS.has(c.kind));
}

export function constraintMetadataBlock(entity: EntityModel): string {
  const cols = businessColumnsWithConstraints(entity);
  if (cols.length === 0) {
    return "const COLUMN_CONSTRAINTS: ColumnConstraintMeta[] = [];";
  }
  const entries = cols
    .map((c) => {
      const parts = [
        `graphqlName: "${c.graphqlName}"`,
        `drizzleKey: "${c.drizzleKey}"`,
      ];
      if (c.maxLength != null) parts.push(`maxLength: ${c.maxLength}`);
      if (c.minExclusive != null) parts.push(`minExclusive: ${c.minExclusive}`);
      if (c.minInclusive != null) parts.push(`minInclusive: ${c.minInclusive}`);
      return `  { ${parts.join(", ")} },`;
    })
    .join("\n");
  return `const COLUMN_CONSTRAINTS: ColumnConstraintMeta[] = [\n${entries}\n];`;
}

export function dalCoreImportBlock(entity: EntityModel): string {
  const scalarImports = collectScalarImports(entity);
  const valueImports = [
    "assertFilterBulkCap",
    "assertFilterBulkConfirm",
    "assertValidUuid",
    "createUserError",
    "CHANGE_EVENT_ID_CAP",
    "CURSOR_VERSION",
    "errorPayload",
    "mapDriverError",
    "QueryEngine",
    "resolveActorId",
    "resolveBulkAtomic",
    "resolveBulkFilterMax",
    "resolveColumnProjectionFromInfo",
    "resolveFilterBudget",
    "successPayload",
    "validateColumnConstraints",
    "ValidationError",
    ...scalarImports,
  ];
  const typeImports = [
    "BulkMutationResult",
    "ColumnConstraintMeta",
    "ColumnDescriptor",
    "EntityChangeEventPayload",
    "FilterAST",
    "RelationDescriptor",
    "RelationProjectionHint",
    "RepositoryContext",
    "ResolvedSortKey",
    "SortInput",
  ];
  valueImports.sort();
  typeImports.sort();
  return `import {
  ${valueImports.join(",\n  ")},
  type ${typeImports.join(",\n  type ")},
} from "@corpdk/dal-core";`;
}

export function cursorSerializeBody(entity: EntityModel, sortCols: ColumnModel[]): string {
  const wireCols = cursorWireKinds(entity);
  const wireByKey = new Map(wireCols.map((c) => [c.drizzleKey, c]));
  const used = sortCols.filter((c) => wireByKey.has(c.drizzleKey));
  if (used.length === 0) {
    return `  return resolvedSort.map((s) => row[s.drizzleKey as keyof typeof row]);`;
  }
  const cases = used
    .map((c) => {
      const ser = SERIALIZE_BY_KIND[c.kind]!;
      const expr = c.notNull
        ? `${ser}(row.${c.drizzleKey})!`
        : `row.${c.drizzleKey} != null ? ${ser}(row.${c.drizzleKey}) : null`;
      return `      case "${c.drizzleKey}":
        return ${expr};`;
    })
    .join("\n");
  return `  return resolvedSort.map((s) => {
    switch (s.drizzleKey) {
${cases}
      default:
        return row[s.drizzleKey as keyof typeof row];
    }
  });`;
}

export function cursorDeserializeBody(entity: EntityModel, sortCols: ColumnModel[]): string {
  const wireCols = cursorWireKinds(entity);
  const tzCols = sortCols.filter((c) => wireCols.some((w) => w.drizzleKey === c.drizzleKey));
  if (tzCols.length === 0) {
    return `  return values;`;
  }
  const cases = tzCols
    .map((c) => {
      if (c.kind === "timestamptz") {
        return `      case "${c.drizzleKey}":
        return new Date(value as string);`;
      }
      return `      case "${c.drizzleKey}":
        return value;`;
    })
    .join("\n");
  return `  return values.map((value, index) => {
    switch (resolvedSort[index]?.drizzleKey) {
${cases}
      default:
        return value;
    }
  });`;
}
