import type { ColumnModel } from "../model.js";

/** Emitted expression fragments referencing `dalScalarZod` in generated `input-zod.ts`. */
export const DAL_SCALAR_ZOD_BY_NAME: Record<string, string> = {
  DateTime: "dalScalarZod.DateTime",
  Date: "dalScalarZod.Date",
  TimeTz: "dalScalarZod.TimeTz",
  BigInt: "dalScalarZod.BigInt",
  Decimal: "dalScalarZod.Decimal",
  IntervalMs: "dalScalarZod.IntervalMs",
  SmallInt: "dalScalarZod.SmallInt",
  Double: "dalScalarZod.Double",
  Citext: "dalScalarZod.Citext",
  IP: "dalScalarZod.IP",
  CIDR: "dalScalarZod.CIDR",
  MAC: "dalScalarZod.MAC",
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
    case "smallint":
      return DAL_SCALAR_ZOD_BY_NAME.SmallInt;
    case "double":
      return DAL_SCALAR_ZOD_BY_NAME.Double;
    case "citext":
      return DAL_SCALAR_ZOD_BY_NAME.Citext;
    case "inet":
      return DAL_SCALAR_ZOD_BY_NAME.IP;
    case "cidr":
      return DAL_SCALAR_ZOD_BY_NAME.CIDR;
    case "macaddr":
      return DAL_SCALAR_ZOD_BY_NAME.MAC;
    default:
      return null;
  }
}

export const INPUT_ZOD_DAL_SCALAR_IMPORT =
  'import { createUserError, dalScalarZod, zPgInt32, zPgReal, type MutationUserError } from "@corpdk/dal-core";';
