import { describe, expect, it } from "vitest";
import {
  DAL_SCALAR_ZOD_BY_NAME,
  dalScalarZodExprForColumnKind,
  INPUT_ZOD_DAL_SCALAR_IMPORT,
} from "../input-zod-scalars.js";

describe("input-zod-scalars", () => {
  it("maps DAL column kinds to dalScalarZod expressions", () => {
    expect(dalScalarZodExprForColumnKind("timestamptz")).toBe(DAL_SCALAR_ZOD_BY_NAME.DateTime);
    expect(dalScalarZodExprForColumnKind("date")).toBe(DAL_SCALAR_ZOD_BY_NAME.Date);
    expect(dalScalarZodExprForColumnKind("timetz")).toBe(DAL_SCALAR_ZOD_BY_NAME.TimeTz);
    expect(dalScalarZodExprForColumnKind("bigint")).toBe(DAL_SCALAR_ZOD_BY_NAME.BigInt);
    expect(dalScalarZodExprForColumnKind("decimal")).toBe(DAL_SCALAR_ZOD_BY_NAME.Decimal);
    expect(dalScalarZodExprForColumnKind("interval")).toBe(DAL_SCALAR_ZOD_BY_NAME.IntervalMs);
    expect(dalScalarZodExprForColumnKind("smallint")).toBe(DAL_SCALAR_ZOD_BY_NAME.SmallInt);
    expect(dalScalarZodExprForColumnKind("double")).toBe(DAL_SCALAR_ZOD_BY_NAME.Double);
    expect(dalScalarZodExprForColumnKind("citext")).toBe(DAL_SCALAR_ZOD_BY_NAME.InsensitiveString);
    expect(dalScalarZodExprForColumnKind("inet")).toBe(DAL_SCALAR_ZOD_BY_NAME.IP);
    expect(dalScalarZodExprForColumnKind("cidr")).toBe(DAL_SCALAR_ZOD_BY_NAME.CIDR);
    expect(dalScalarZodExprForColumnKind("macaddr")).toBe(DAL_SCALAR_ZOD_BY_NAME.MAC);
    expect(dalScalarZodExprForColumnKind("varchar")).toBeNull();
  });

  it("exports the generated module dal-core import line", () => {
    expect(INPUT_ZOD_DAL_SCALAR_IMPORT).toContain("dalScalarZod");
    expect(INPUT_ZOD_DAL_SCALAR_IMPORT).toContain("@corpdk/dal-core");
  });
});
