import { GraphQLBigInt, GraphQLDate, GraphQLDateTimeISO } from "graphql-scalars";
import { z, type ZodType } from "zod";
import {
  parseBigInt,
  parseDate,
  parseDateTime,
  parseDecimal,
  parseIntervalMs,
  parseTimeTz,
} from "./scalars.js";

function issueFromError(ctx: z.RefinementCtx, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Invalid scalar value";
  ctx.addIssue({ code: "custom", message });
}

function wireStringSchema(parse: (value: string) => unknown): ZodType<string> {
  return z.string().superRefine((val, ctx) => {
    try {
      parse(val);
    } catch (error) {
      issueFromError(ctx, error);
    }
  });
}

function parseBigIntCoerced(value: unknown): string {
  const validated = GraphQLBigInt.parseValue(value);
  const decimal =
    typeof validated === "bigint"
      ? validated.toString()
      : typeof validated === "number"
        ? Math.trunc(validated).toString()
        : String(validated);
  return parseBigInt(decimal);
}

const zDateTime = z.string().superRefine((val, ctx) => {
  try {
    GraphQLDateTimeISO.parseValue(val);
    parseDateTime(val);
  } catch (error) {
    issueFromError(ctx, error);
  }
});

const zDate = z.string().superRefine((val, ctx) => {
  try {
    GraphQLDate.parseValue(val);
    parseDate(val);
  } catch (error) {
    issueFromError(ctx, error);
  }
});

const zBigInt = z.union([z.string(), z.number().finite(), z.bigint()]).superRefine((val, ctx) => {
  try {
    parseBigIntCoerced(val);
  } catch (error) {
    issueFromError(ctx, error);
  }
});

const zDecimal = wireStringSchema((v) => parseDecimal(v));
const zTimeTz = wireStringSchema((v) => parseTimeTz(v));

const zIntervalMs = z
  .union([z.string(), z.number().finite(), z.bigint()])
  .superRefine((val, ctx) => {
    try {
      parseIntervalMs(val);
    } catch (error) {
      issueFromError(ctx, error);
    }
  });

/** Zod validators aligned with dal-core GraphQL scalar parse rules (mutation/filter inputs). */
export const dalScalarZod = {
  DateTime: zDateTime,
  Date: zDate,
  TimeTz: zTimeTz,
  BigInt: zBigInt,
  Decimal: zDecimal,
  IntervalMs: zIntervalMs,
} as const;

export type DalScalarZodName = keyof typeof dalScalarZod;
