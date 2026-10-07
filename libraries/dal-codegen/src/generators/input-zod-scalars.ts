import type { ColumnModel } from "../model.js";

/** Emitted expression fragments referencing `dalScalarZod` in generated `input-zod.ts`. */
export const DAL_SCALAR_ZOD_BY_NAME: Record<string, string> = {
  DateTime: "dalScalarZod.DateTime",
  Date: "dalScalarZod.Date",
  TimeTz: "dalScalarZod.TimeTz",
  BigInt: "dalScalarZod.BigInt",
  Decimal: "dalScalarZod.Decimal",
  IntervalMs: "dalScalarZod.IntervalMs",
};

export function dalScalarZodExprForColumnKind(kind: ColumnModel["kind"]): string | null {
  switch (kind) {
    case "timestamptz":
      return DAL_SCALAR_ZOD_BY_NAME.DateTime;
    case "date":
      return DAL_SCALAR_ZOD_BY_NAME.Date;
    case "timetz":
      return DAL_SCALAR_ZOD_BY_NAME.TimeTz;
    case "bigint":
      return DAL_SCALAR_ZOD_BY_NAME.BigInt;
    case "decimal":
      return DAL_SCALAR_ZOD_BY_NAME.Decimal;
    case "interval":
      return DAL_SCALAR_ZOD_BY_NAME.IntervalMs;
    default:
      return null;
  }
}

export const INPUT_ZOD_DAL_SCALAR_IMPORT =
  'import { createUserError, dalScalarZod, type MutationUserError } from "@corpdk/dal-core";';
