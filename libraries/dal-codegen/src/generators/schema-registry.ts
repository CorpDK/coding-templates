import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLString,
  type GraphQLNamedType,
  type GraphQLType,
} from "graphql";
import {
  dalGraphQLScalar,
  type DalCustomScalarName,
} from "@corpdk/dal-core";
import type { ColumnModel, EntityModel } from "../model.js";
import { filterableColumns, visibleOutputColumns } from "./schema-utils.js";

type CustomScalar = DalCustomScalarName;

type FilterInputName =
  | "StringFilter"
  | "BooleanFilter"
  | "DateTimeFilter"
  | "IDFilter"
  | "IntFilter"
  | "SmallIntFilter"
  | "FloatFilter"
  | "DoubleFilter"
  | "BigIntFilter"
  | "DecimalFilter"
  | "DateFilter"
  | "TimeTzFilter"
  | "IntervalMsFilter"
  | "CitextFilter"
  | "IPFilter"
  | "CIDRFilter"
  | "MACFilter";

export interface GraphqlEnumDef {
  name: string;
  values: string[];
}

/** Custom scalars referenced by entity columns (stable order for SDL emission). */
export function collectUsedDalScalars(entities: EntityModel[]): CustomScalar[] {
  return collectUsedTypes(entities).scalars;
}

function customScalarForColumn(col: ColumnModel): CustomScalar | null {
  switch (col.kind) {
    case "timestamptz":
      return "DateTime";
    case "bigint":
      return "BigInt";
    case "decimal":
      return "Decimal";
    case "date":
      return "Date";
    case "timetz":
      return "TimeTz";
    case "interval":
      return "IntervalMs";
    case "smallint":
      return "SmallInt";
    case "double":
      return "Double";
    case "citext":
      return "Citext";
    case "inet":
      return "IP";
    case "cidr":
      return "CIDR";
    case "macaddr":
      return "MAC";
    default:
      return null;
  }
}

function filterForColumnKind(col: ColumnModel): FilterInputName | null {
  switch (col.kind) {
    case "uuid":
      return "IDFilter";
    case "boolean":
      return "BooleanFilter";
    case "timestamptz":
      return "DateTimeFilter";
    case "text":
    case "varchar":
      return "StringFilter";
    case "smallint":
      return "SmallIntFilter";
    case "integer":
      return "IntFilter";
    case "real":
      return "FloatFilter";
    case "double":
      return "DoubleFilter";
    case "citext":
      return "CitextFilter";
    case "inet":
      return "IPFilter";
    case "cidr":
      return "CIDRFilter";
    case "macaddr":
      return "MACFilter";
    case "bigint":
      return "BigIntFilter";
    case "decimal":
      return "DecimalFilter";
    case "date":
      return "DateFilter";
    case "timetz":
      return "TimeTzFilter";
    case "interval":
      return "IntervalMsFilter";
    case "enum":
      return null;
    default:
      return null;
  }
}

function collectEnums(entities: EntityModel[]): GraphqlEnumDef[] {
  const byName = new Map<string, Set<string>>();
  for (const entity of entities) {
    for (const col of entity.columns) {
      if (col.kind !== "enum" || !col.enumName || !col.enumValues?.length) continue;
      const values = byName.get(col.enumName) ?? new Set<string>();
      for (const value of col.enumValues) values.add(value);
      byName.set(col.enumName, values);
    }
  }
  return [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, values]) => ({
      name,
      values: [...values].sort((a, b) => a.localeCompare(b)),
    }));
}

function collectUsedTypes(entities: EntityModel[]): {
  scalars: CustomScalar[];
  filters: FilterInputName[];
  enums: GraphqlEnumDef[];
} {
  const scalarSet = new Set<CustomScalar>();
  const filterSet = new Set<FilterInputName>();

  for (const entity of entities) {
    for (const col of visibleOutputColumns(entity)) {
      const scalar = customScalarForColumn(col);
      if (scalar) scalarSet.add(scalar);
    }
    for (const col of filterableColumns(entity)) {
      const filter = filterForColumnKind(col);
      if (filter) filterSet.add(filter);
    }
  }

  const scalarOrder: CustomScalar[] = [
    "DateTime",
    "Date",
    "TimeTz",
    "BigInt",
    "Decimal",
    "IntervalMs",
    "SmallInt",
    "Double",
    "Citext",
    "IP",
    "CIDR",
    "MAC",
  ];
  const filterOrder: FilterInputName[] = [
    "StringFilter",
    "BooleanFilter",
    "DateTimeFilter",
    "IDFilter",
    "IntFilter",
    "SmallIntFilter",
    "FloatFilter",
    "DoubleFilter",
    "BigIntFilter",
    "DecimalFilter",
    "DateFilter",
    "TimeTzFilter",
    "IntervalMsFilter",
    "CitextFilter",
    "IPFilter",
    "CIDRFilter",
    "MACFilter",
  ];

  return {
    scalars: scalarOrder.filter((s) => scalarSet.has(s)),
    filters: filterOrder.filter((f) => filterSet.has(f)),
    enums: collectEnums(entities),
  };
}

function buildStringFilter(): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "StringFilter",
    description: "Filter operators for string columns.",
    fields: {
      eq: { type: GraphQLString },
      neq: { type: GraphQLString },
      like: { type: GraphQLString },
      in: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
      isNull: {
        type: GraphQLBoolean,
        description: "True = IS NULL; false = IS NOT NULL; nullable columns only.",
      },
      isCaseInsensitive: {
        type: GraphQLBoolean,
        description: "When true, eq/neq/like/in/notIn use case-insensitive matching.",
      },
    },
  });
}

function buildBooleanFilter(): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "BooleanFilter",
    description: "Filter operators for boolean columns.",
    fields: {
      eq: { type: GraphQLBoolean },
    },
  });
}

function buildDateTimeFilter(dateTime: GraphQLScalarType): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "DateTimeFilter",
    description: "Filter operators for timestamptz columns.",
    fields: {
      eq: { type: dateTime },
      neq: { type: dateTime },
      gt: { type: dateTime },
      gte: { type: dateTime },
      lt: { type: dateTime },
      lte: { type: dateTime },
      in: { type: new GraphQLList(new GraphQLNonNull(dateTime)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(dateTime)) },
      isNull: {
        type: GraphQLBoolean,
        description: "True = IS NULL; false = IS NOT NULL; nullable columns only.",
      },
    },
  });
}

function buildIdFilter(): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "IDFilter",
    description: "Filter operators for UUID primary keys and foreign keys.",
    fields: {
      eq: { type: GraphQLID },
      neq: { type: GraphQLID },
      in: { type: new GraphQLList(new GraphQLNonNull(GraphQLID)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(GraphQLID)) },
    },
  });
}

function buildIntFilter(): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "IntFilter",
    description: "Filter operators for integer columns.",
    fields: {
      eq: { type: GraphQLInt },
      neq: { type: GraphQLInt },
      gt: { type: GraphQLInt },
      gte: { type: GraphQLInt },
      lt: { type: GraphQLInt },
      lte: { type: GraphQLInt },
      in: { type: new GraphQLList(new GraphQLNonNull(GraphQLInt)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(GraphQLInt)) },
      isNull: {
        type: GraphQLBoolean,
        description: "True = IS NULL; false = IS NOT NULL; nullable columns only.",
      },
    },
  });
}

function buildSmallIntFilter(smallInt: GraphQLScalarType): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "SmallIntFilter",
    description: "Filter operators for smallint columns.",
    fields: {
      eq: { type: smallInt },
      neq: { type: smallInt },
      gt: { type: smallInt },
      gte: { type: smallInt },
      lt: { type: smallInt },
      lte: { type: smallInt },
      in: { type: new GraphQLList(new GraphQLNonNull(smallInt)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(smallInt)) },
      isNull: {
        type: GraphQLBoolean,
        description: "True = IS NULL; false = IS NOT NULL; nullable columns only.",
      },
    },
  });
}

function buildFloatFilter(): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "FloatFilter",
    description: "Filter operators for real (binary32) columns.",
    fields: {
      eq: { type: GraphQLFloat },
      neq: { type: GraphQLFloat },
      gt: { type: GraphQLFloat },
      gte: { type: GraphQLFloat },
      lt: { type: GraphQLFloat },
      lte: { type: GraphQLFloat },
      in: { type: new GraphQLList(new GraphQLNonNull(GraphQLFloat)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(GraphQLFloat)) },
      isNull: {
        type: GraphQLBoolean,
        description: "True = IS NULL; false = IS NOT NULL; nullable columns only.",
      },
    },
  });
}

function buildDoubleFilter(doubleScalar: GraphQLScalarType): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "DoubleFilter",
    description: "Filter operators for double precision columns.",
    fields: {
      eq: { type: doubleScalar },
      neq: { type: doubleScalar },
      gt: { type: doubleScalar },
      gte: { type: doubleScalar },
      lt: { type: doubleScalar },
      lte: { type: doubleScalar },
      in: { type: new GraphQLList(new GraphQLNonNull(doubleScalar)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(doubleScalar)) },
      isNull: {
        type: GraphQLBoolean,
        description: "True = IS NULL; false = IS NOT NULL; nullable columns only.",
      },
    },
  });
}

function buildCitextFilter(citext: GraphQLScalarType): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "CitextFilter",
    description: "Filter operators for citext columns.",
    fields: {
      eq: { type: citext },
      neq: { type: citext },
      like: { type: citext },
      in: { type: new GraphQLList(new GraphQLNonNull(citext)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(citext)) },
      isNull: {
        type: GraphQLBoolean,
        description: "True = IS NULL; false = IS NOT NULL; nullable columns only.",
      },
      isCaseInsensitive: {
        type: GraphQLBoolean,
        description: "When true, eq/neq/like/in/notIn use case-insensitive matching.",
      },
    },
  });
}

function buildEqNeqNetworkFilter(
  name: string,
  description: string,
  scalar: GraphQLScalarType,
): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name,
    description,
    fields: {
      eq: { type: scalar },
      neq: { type: scalar },
      isNull: {
        type: GraphQLBoolean,
        description: "True = IS NULL; false = IS NOT NULL; nullable columns only.",
      },
    },
  });
}

function buildBigIntFilter(bigInt: GraphQLScalarType): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "BigIntFilter",
    description: "Filter operators for bigint columns.",
    fields: {
      eq: { type: bigInt },
      neq: { type: bigInt },
      gt: { type: bigInt },
      gte: { type: bigInt },
      lt: { type: bigInt },
      lte: { type: bigInt },
      in: { type: new GraphQLList(new GraphQLNonNull(bigInt)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(bigInt)) },
    },
  });
}

function buildDecimalFilter(decimal: GraphQLScalarType): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "DecimalFilter",
    description: "Filter operators for decimal columns.",
    fields: {
      eq: { type: decimal },
      neq: { type: decimal },
      gt: { type: decimal },
      gte: { type: decimal },
      lt: { type: decimal },
      lte: { type: decimal },
      in: { type: new GraphQLList(new GraphQLNonNull(decimal)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(decimal)) },
    },
  });
}

function buildDateFilter(date: GraphQLScalarType): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "DateFilter",
    description: "Filter operators for date columns.",
    fields: {
      eq: { type: date },
      neq: { type: date },
      gt: { type: date },
      gte: { type: date },
      lt: { type: date },
      lte: { type: date },
      in: { type: new GraphQLList(new GraphQLNonNull(date)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(date)) },
      isNull: {
        type: GraphQLBoolean,
        description: "True = IS NULL; false = IS NOT NULL; nullable columns only.",
      },
    },
  });
}

function buildTimeTzFilter(timeTz: GraphQLScalarType): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "TimeTzFilter",
    description: "Filter operators for timetz columns.",
    fields: {
      eq: { type: timeTz },
      neq: { type: timeTz },
      gt: { type: timeTz },
      gte: { type: timeTz },
      lt: { type: timeTz },
      lte: { type: timeTz },
      in: { type: new GraphQLList(new GraphQLNonNull(timeTz)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(timeTz)) },
      isNull: {
        type: GraphQLBoolean,
        description: "True = IS NULL; false = IS NOT NULL; nullable columns only.",
      },
    },
  });
}

function buildIntervalMsFilter(intervalMs: GraphQLScalarType): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: "IntervalMsFilter",
    description: "Filter operators for interval columns.",
    fields: {
      eq: { type: intervalMs },
      neq: { type: intervalMs },
      gt: { type: intervalMs },
      gte: { type: intervalMs },
      lt: { type: intervalMs },
      lte: { type: intervalMs },
      in: { type: new GraphQLList(new GraphQLNonNull(intervalMs)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(intervalMs)) },
    },
  });
}

function buildEnumFilter(enumType: GraphQLEnumType): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: `${enumType.name}Filter`,
    description: `Filter operators for ${enumType.name} enum columns.`,
    fields: {
      eq: { type: enumType },
      neq: { type: enumType },
      in: { type: new GraphQLList(new GraphQLNonNull(enumType)) },
      notIn: { type: new GraphQLList(new GraphQLNonNull(enumType)) },
    },
  });
}

export interface SchemaRegistry {
  types: Map<string, GraphQLNamedType>;
  sortDirection: GraphQLEnumType;
  changeOperation: GraphQLEnumType;
  pageInfo: GraphQLObjectType;
  mutationUserError: GraphQLObjectType;
  bulkMutationResult: GraphQLObjectType;
}

const BUILTIN_TYPES = new Map<string, GraphQLNamedType>([
  ["String", GraphQLString],
  ["Boolean", GraphQLBoolean],
  ["ID", GraphQLID],
  ["Int", GraphQLInt],
]);

/** Resolves a named type from the registry; throws if missing. */
export function registryType(registry: SchemaRegistry, name: string): GraphQLNamedType {
  const type = registry.types.get(name) ?? BUILTIN_TYPES.get(name);
  if (!type) {
    throw new Error(`Schema build error: unknown type reference '${name}'`);
  }
  return type;
}

/** Resolves a type reference string (e.g. `ID!`, `[String!]`) from the registry. */
export function registryTypeRef(registry: SchemaRegistry, sdl: string): GraphQLType {
  let rest = sdl.trim();
  let nullable = true;

  if (rest.endsWith("!")) {
    nullable = false;
    rest = rest.slice(0, -1);
  }

  let inner: GraphQLType;
  if (rest.startsWith("[") && rest.endsWith("]")) {
    const elem = rest.slice(1, -1).replace(/!$/, "");
    inner = new GraphQLList(registryTypeRef(registry, elem));
  } else {
    inner = registryType(registry, rest);
  }

  return nullable ? inner : new GraphQLNonNull(inner);
}

export function buildSchemaRegistry(entities: EntityModel[]): SchemaRegistry {
  const { scalars, filters, enums } = collectUsedTypes(entities);
  const types = new Map<string, GraphQLNamedType>();

  const customScalars = new Map<CustomScalar, GraphQLScalarType>();
  for (const scalar of scalars) {
    const type = dalGraphQLScalar(scalar);
    customScalars.set(scalar, type);
    types.set(scalar, type);
  }

  for (const enumDef of enums) {
    const enumType = new GraphQLEnumType({
      name: enumDef.name,
      description: `Enum values for ${enumDef.name}.`,
      values: Object.fromEntries(
        enumDef.values.map((value) => [value, { value }]),
      ),
    });
    types.set(enumDef.name, enumType);
    types.set(`${enumDef.name}Filter`, buildEnumFilter(enumType));
  }

  const pageInfo = new GraphQLObjectType({
    name: "PageInfo",
    description: "Relay pagination metadata.",
    fields: {
      hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
      hasPreviousPage: { type: new GraphQLNonNull(GraphQLBoolean) },
      startCursor: { type: GraphQLString },
      endCursor: { type: GraphQLString },
    },
  });
  types.set("PageInfo", pageInfo);

  const mutationUserError = new GraphQLObjectType({
    name: "MutationUserError",
    description: "Field-level validation or business rule failure on a mutation.",
    fields: {
      code: { type: GraphQLString },
      message: { type: new GraphQLNonNull(GraphQLString) },
      field: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
      id: { type: GraphQLID },
    },
  });
  types.set("MutationUserError", mutationUserError);

  const bulkMutationResult = new GraphQLObjectType({
    name: "BulkMutationResult",
    description: "Partial or failed bulk mutation outcome with per-row errors.",
    fields: {
      successCount: { type: new GraphQLNonNull(GraphQLInt) },
      failureCount: { type: new GraphQLNonNull(GraphQLInt) },
      userErrors: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(mutationUserError)),
        ),
      },
    },
  });
  types.set("BulkMutationResult", bulkMutationResult);

  const changeOperation = new GraphQLEnumType({
    name: "ChangeOperation",
    description: "Lifecycle operation for subscription change events.",
    values: {
      CREATED: { value: "CREATED" },
      UPDATED: { value: "UPDATED" },
      DELETED: { value: "DELETED" },
    },
  });
  types.set("ChangeOperation", changeOperation);

  const sortDirection = new GraphQLEnumType({
    name: "SortDirection",
    description: "Ascending or descending sort order.",
    values: {
      ASC: { value: "ASC" },
      DESC: { value: "DESC" },
    },
  });
  types.set("SortDirection", sortDirection);

  const dateTime = customScalars.get("DateTime");
  const bigInt = customScalars.get("BigInt");
  const decimal = customScalars.get("Decimal");
  const date = customScalars.get("Date");
  const timeTz = customScalars.get("TimeTz");
  const intervalMs = customScalars.get("IntervalMs");
  const smallInt = customScalars.get("SmallInt");
  const doubleScalar = customScalars.get("Double");
  const citext = customScalars.get("Citext");
  const ip = customScalars.get("IP");
  const cidr = customScalars.get("CIDR");
  const mac = customScalars.get("MAC");

  const filterBuilders: Partial<Record<FilterInputName, () => GraphQLInputObjectType>> = {
    StringFilter: buildStringFilter,
    BooleanFilter: buildBooleanFilter,
    DateTimeFilter: () => {
      if (!dateTime) throw new Error("DateTimeFilter requires DateTime scalar");
      return buildDateTimeFilter(dateTime);
    },
    IDFilter: buildIdFilter,
    IntFilter: buildIntFilter,
    SmallIntFilter: () => {
      if (!smallInt) throw new Error("SmallIntFilter requires SmallInt scalar");
      return buildSmallIntFilter(smallInt);
    },
    FloatFilter: buildFloatFilter,
    DoubleFilter: () => {
      if (!doubleScalar) throw new Error("DoubleFilter requires Double scalar");
      return buildDoubleFilter(doubleScalar);
    },
    BigIntFilter: () => {
      if (!bigInt) throw new Error("BigIntFilter requires BigInt scalar");
      return buildBigIntFilter(bigInt);
    },
    DecimalFilter: () => {
      if (!decimal) throw new Error("DecimalFilter requires Decimal scalar");
      return buildDecimalFilter(decimal);
    },
    DateFilter: () => {
      if (!date) throw new Error("DateFilter requires Date scalar");
      return buildDateFilter(date);
    },
    TimeTzFilter: () => {
      if (!timeTz) throw new Error("TimeTzFilter requires TimeTz scalar");
      return buildTimeTzFilter(timeTz);
    },
    IntervalMsFilter: () => {
      if (!intervalMs) throw new Error("IntervalMsFilter requires IntervalMs scalar");
      return buildIntervalMsFilter(intervalMs);
    },
    CitextFilter: () => {
      if (!citext) throw new Error("CitextFilter requires Citext scalar");
      return buildCitextFilter(citext);
    },
    IPFilter: () => {
      if (!ip) throw new Error("IPFilter requires IP scalar");
      return buildEqNeqNetworkFilter("IPFilter", "Filter operators for inet columns.", ip);
    },
    CIDRFilter: () => {
      if (!cidr) throw new Error("CIDRFilter requires CIDR scalar");
      return buildEqNeqNetworkFilter("CIDRFilter", "Filter operators for cidr columns.", cidr);
    },
    MACFilter: () => {
      if (!mac) throw new Error("MACFilter requires MAC scalar");
      return buildEqNeqNetworkFilter(
        "MACFilter",
        "Filter operators for macaddr columns.",
        mac,
      );
    },
  };

  for (const filter of filters) {
    const build = filterBuilders[filter];
    if (build) {
      const type = build();
      types.set(filter, type);
    }
  }

  return { types, sortDirection, changeOperation, pageInfo, mutationUserError, bulkMutationResult };
}
