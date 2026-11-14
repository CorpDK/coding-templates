import { GraphQLBigInt, GraphQLDate, GraphQLDateTimeISO } from "graphql-scalars";
import { z, type ZodType } from "zod";
import {
  parseBigInt,
  parseCidr,
  parseCitext,
  parseDate,
  parseDateTime,
  parseDecimal,
  parseInet,
  parseMacAddr,
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
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new TypeError(
      "BigInt number input must be a safe integer; use a decimal string for larger values",
    );
  }
  const validated = GraphQLBigInt.parseValue(value);
  let decimal: string;
  if (typeof validated === "bigint") {
    decimal = validated.toString();
  } else if (typeof validated === "number") {
    if (!Number.isSafeInteger(validated)) {
      throw new TypeError(
        "BigInt number input must be a safe integer; use a decimal string for larger values",
      );
    }
    decimal = Math.trunc(validated).toString();
  } else {
    decimal = String(validated);
  }
  return parseBigInt(decimal);
}

export const zDateTime = z.string().superRefine((val, ctx) => {
  try {
    GraphQLDateTimeISO.parseValue(val);
    parseDateTime(val);
  } catch (error) {
    issueFromError(ctx, error);
  }
});

export const zDate = z.string().superRefine((val, ctx) => {
  try {
    GraphQLDate.parseValue(val);
    parseDate(val);
  } catch (error) {
    issueFromError(ctx, error);
  }
});

/** Unbounded GraphQL BigInt wire validation. */
export const zBigInt = z
  .union([z.string(), z.number().finite(), z.bigint()])
  .superRefine((val, ctx) => {
    try {
      parseBigIntCoerced(val);
    } catch (error) {
      issueFromError(ctx, error);
    }
  });

export const zDecimal = wireStringSchema((v) => parseDecimal(v));
export const zTimeTz = wireStringSchema((v) => parseTimeTz(v));
export const zInsensitiveString = wireStringSchema((v) => parseCitext(v));
export const zIP = wireStringSchema((v) => parseInet(v));
export const zCidr = wireStringSchema((v) => parseCidr(v));
export const zMAC = wireStringSchema((v) => parseMacAddr(v));