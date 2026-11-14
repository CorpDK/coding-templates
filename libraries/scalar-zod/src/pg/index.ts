import { z, type ZodType } from "zod";
import {
  PG_INT32_MAX,
  PG_INT32_MIN,
  PG_INT64_MAX,
  PG_INT64_MIN,
  PG_REAL_MAX,
  PG_REAL_MIN,
  PG_SMALLINT_MAX,
  PG_SMALLINT_MIN,
} from "../pg-bounds.js";
import { parseDouble, parseIntervalMs, parseSmallInt } from "../scalars.js";
import {
  zBigInt,
  zCidr,
  zDate,
  zDateTime,
  zDecimal,
  zInsensitiveString,
  zIP,
  zMAC,
  zTimeTz,
} from "../wire-zod.js";

export {
  PG_INT32_MAX,
  PG_INT32_MIN,
  PG_INT64_MAX,
  PG_INT64_MIN,
  PG_REAL_MAX,
  PG_REAL_MIN,
  PG_SMALLINT_MAX,
  PG_SMALLINT_MIN,
} from "../pg-bounds.js";
export { intervalMsToPgInterval, pgIntervalTextToMs } from "../pg-interval.js";

function issueFromError(ctx: z.RefinementCtx, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Invalid scalar value";
  ctx.addIssue({ code: "custom", message });
}

function int64MsSchema(): ZodType<string | number | bigint> {
  return z
    .union([z.string(), z.number().finite(), z.bigint()])
    .superRefine((val, ctx) => {
      try {
        const wire = parseIntervalMs(val);
        const bi = BigInt(wire);
        if (bi < PG_INT64_MIN || bi > PG_INT64_MAX) {
          ctx.addIssue({
            code: "custom",
            message: "IntervalMs out of signed 64-bit range",
          });
        }
      } catch (error) {
        issueFromError(ctx, error);
      }
    });
}

const zIntervalMs = int64MsSchema();

const zSmallInt = z
  .number()
  .int()
  .min(PG_SMALLINT_MIN)
  .max(PG_SMALLINT_MAX)
  .superRefine((val, ctx) => {
    try {
      parseSmallInt(val);
    } catch (error) {
      issueFromError(ctx, error);
    }
  });

const zDouble = z
  .number()
  .finite()
  .superRefine((val, ctx) => {
    try {
      parseDouble(val);
    } catch (error) {
      issueFromError(ctx, error);
    }
  });

/** Zod for GraphQL built-in Int mapped from PG `integer` (32-bit). */
export const zPgInt32 = z.number().int().min(PG_INT32_MIN).max(PG_INT32_MAX);

/** Zod for GraphQL built-in Float mapped from PG `real` (IEEE binary32). */
export const zPgReal = z.number().finite().min(PG_REAL_MIN).max(PG_REAL_MAX);

/** Zod validators aligned with DAL GraphQL scalar parse rules (mutation/filter inputs). */
export const dalScalarZod = {
  DateTime: zDateTime,
  Date: zDate,
  TimeTz: zTimeTz,
  BigInt: zBigInt,
  Decimal: zDecimal,
  IntervalMs: zIntervalMs,
  SmallInt: zSmallInt,
  Double: zDouble,
  InsensitiveString: zInsensitiveString,
  IP: zIP,
  CIDR: zCidr,
  MAC: zMAC,
} as const;

export type DalScalarZodName = keyof typeof dalScalarZod;
