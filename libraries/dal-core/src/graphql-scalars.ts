import { GraphQLScalarType, Kind, type ValueNode } from "graphql";
import { GraphQLBigInt, GraphQLDate, GraphQLDateTimeISO } from "graphql-scalars";
import {
  parseBigInt,
  parseDate,
  parseDateTime,
  parseDecimal,
  parseIntervalMs,
  parseTimeTz,
  serializeBigInt,
  serializeDate,
  serializeDateTime,
  serializeDecimal,
  serializeIntervalMs,
  serializeTimeTz,
} from "./scalars.js";

/** Six core DAL custom GraphQL scalars (§3.1). */
export const DAL_CUSTOM_SCALAR_NAMES = [
  "DateTime",
  "Date",
  "TimeTz",
  "BigInt",
  "Decimal",
  "IntervalMs",
] as const;

export type DalCustomScalarName = (typeof DAL_CUSTOM_SCALAR_NAMES)[number];

const SCALAR_DESCRIPTIONS: Record<DalCustomScalarName, string> = {
  DateTime: "ISO-8601 UTC timestamp with milliseconds.",
  Date: "ISO-8601 calendar date (YYYY-MM-DD).",
  TimeTz: "ISO-8601 time with timezone offset.",
  BigInt: "Signed 64-bit integer serialized as a decimal string.",
  Decimal: "Arbitrary-precision decimal serialized as a string.",
  IntervalMs: "Duration as signed milliseconds.",
};

function parseStringLiteral(ast: ValueNode, scalarName: string): string {
  if (ast.kind !== Kind.STRING) {
    throw new TypeError(`${scalarName} must be a string literal`);
  }
  return ast.value;
}

/** graphql-scalars BigInt accepts string/number; dal-core enforces signed int64 decimal string wire. */
function parseBigIntWire(value: unknown): string {
  const validated = GraphQLBigInt.parseValue(value);
  const decimal =
    typeof validated === "bigint"
      ? validated.toString()
      : typeof validated === "number"
        ? Math.trunc(validated).toString()
        : String(validated);
  return parseBigInt(decimal);
}

function parseBigIntLiteral(ast: ValueNode): string {
  const validated = GraphQLBigInt.parseLiteral(ast);
  const decimal =
    typeof validated === "bigint"
      ? validated.toString()
      : typeof validated === "number"
        ? Math.trunc(validated).toString()
        : String(validated);
  return parseBigInt(decimal);
}

function wireScalar(
  name: DalCustomScalarName,
  description: string,
  parseWire: (value: unknown) => string,
  serializeWire: (value: unknown) => string | null,
): GraphQLScalarType {
  const serialize = (value: unknown) => serializeWire(value);
  return new GraphQLScalarType({
    name,
    description,
    serialize,
    parseValue: (value) => parseWire(value),
    parseLiteral: (ast) => parseWire(parseStringLiteral(ast, name)),
  });
}

const GraphQLDalDateTime = new GraphQLScalarType({
  name: "DateTime",
  description: SCALAR_DESCRIPTIONS.DateTime,
  serialize: (value) => serializeDateTime(value as Date | string | null | undefined),
  parseValue: (value) => {
    GraphQLDateTimeISO.parseValue(value);
    const normalized =
      value instanceof Date
        ? value
        : typeof value === "string"
          ? parseDateTime(value)
          : parseDateTime(String(value));
    return serializeDateTime(normalized)!;
  },
  parseLiteral: (ast) => {
    const raw = parseStringLiteral(ast, "DateTime");
    GraphQLDateTimeISO.parseValue(raw);
    return serializeDateTime(parseDateTime(raw))!;
  },
});

const GraphQLDalDate = new GraphQLScalarType({
  name: "Date",
  description: SCALAR_DESCRIPTIONS.Date,
  serialize: (value) => serializeDate(value as Date | string | null | undefined),
  parseValue: (value) => {
    GraphQLDate.parseValue(value);
    if (value instanceof Date) {
      return serializeDate(value)!;
    }
    return parseDate(value);
  },
  parseLiteral: (ast) => {
    const raw = parseStringLiteral(ast, "Date");
    GraphQLDate.parseValue(raw);
    return parseDate(raw);
  },
});

const GraphQLDalTimeTz = wireScalar(
  "TimeTz",
  SCALAR_DESCRIPTIONS.TimeTz,
  parseTimeTz,
  (value) => serializeTimeTz(value as string | null | undefined),
);

const GraphQLDalBigInt = new GraphQLScalarType({
  name: "BigInt",
  description: SCALAR_DESCRIPTIONS.BigInt,
  serialize: (value) =>
    serializeBigInt(value as bigint | number | string | null | undefined),
  parseValue: (value) => parseBigIntWire(value),
  parseLiteral: (ast) => parseBigIntLiteral(ast),
});

const GraphQLDalDecimal = wireScalar(
  "Decimal",
  SCALAR_DESCRIPTIONS.Decimal,
  parseDecimal,
  (value) => serializeDecimal(value as string | number | null | undefined),
);

const GraphQLDalIntervalMs = wireScalar(
  "IntervalMs",
  SCALAR_DESCRIPTIONS.IntervalMs,
  parseIntervalMs,
  (value) => serializeIntervalMs(value as string | number | bigint | null | undefined),
);

const DAL_GRAPHQL_SCALAR_TYPES: Record<DalCustomScalarName, GraphQLScalarType> = {
  DateTime: GraphQLDalDateTime,
  Date: GraphQLDalDate,
  TimeTz: GraphQLDalTimeTz,
  BigInt: GraphQLDalBigInt,
  Decimal: GraphQLDalDecimal,
  IntervalMs: GraphQLDalIntervalMs,
};

/** GraphQL scalar type for SDL registry / Yoga (strict parseLiteral + dal-core wire). */
export function dalGraphQLScalar(name: DalCustomScalarName): GraphQLScalarType {
  return DAL_GRAPHQL_SCALAR_TYPES[name];
}

/** Resolver map entries for GraphQL Yoga (`createSchema` merge). */
export function dalScalarResolversFor(
  names: readonly DalCustomScalarName[],
): Record<string, GraphQLScalarType> {
  const out: Record<string, GraphQLScalarType> = {};
  for (const name of names) {
    out[name] = dalGraphQLScalar(name);
  }
  return out;
}
