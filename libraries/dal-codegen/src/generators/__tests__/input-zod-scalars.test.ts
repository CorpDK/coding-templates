import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { EntityModel } from "../../model.js";
import {
  DAL_SCALAR_ZOD_BY_NAME,
  dalScalarZodExprForColumnKind,
} from "../input-zod-scalars.js";
import { generateInputZodModule } from "../input-zod.js";
import { itemFixture } from "./sdl.fixture.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const generatedModuleDir = join(packageRoot, "src/__tests__/tmp-generated");

const hostFixture: EntityModel = {
  ...itemFixture,
  exportName: "hosts",
  tableName: "hosts",
  graphqlType: "Host",
  fieldBasename: "host",
  listField: "hosts",
  columns: [
    ...itemFixture.columns,
    {
      drizzleKey: "address",
      physicalName: "address",
      graphqlName: "address",
      kind: "inet",
      notNull: true,
      hasDefault: false,
      comment: "Host IPv4/IPv6 address.",
      isServerManaged: false,
      isBusiness: true,
    },
  ],
};

async function loadGeneratedInputZod(entities: EntityModel[]) {
  const generatedModulePath = join(generatedModuleDir, "input-zod-scalars-runtime.ts");
  mkdirSync(generatedModuleDir, { recursive: true });
  writeFileSync(generatedModulePath, generateInputZodModule(entities), "utf-8");
  return import(pathToFileURL(generatedModulePath).href) as Promise<{
    safeParseGraphqlInput: (
      name: string,
      value: unknown,
    ) =>
      | { ok: true; data: Record<string, unknown> }
      | { ok: false; userErrors: { message: string }[] };
  }>;
}

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

  it("loads generated input-zod module and validates inet wire values", async () => {
    const mod = await loadGeneratedInputZod([hostFixture]);
    const valid = mod.safeParseGraphqlInput("HostCreateInput", {
      name: "edge",
      address: "203.0.113.10",
    });
    expect(valid.ok).toBe(true);

    const invalid = mod.safeParseGraphqlInput("HostCreateInput", {
      name: "edge",
      address: "not-an-ip",
    });
    expect(invalid.ok).toBe(false);
  });
});
