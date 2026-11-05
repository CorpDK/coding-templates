import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { GraphQLError } from "graphql";
import type { EntityModel } from "../../model.js";
import { generateInputZodModule } from "../input-zod.js";
import { itemFixture } from "./sdl.fixture.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const generatedModuleDir = join(packageRoot, "src/__tests__/tmp-generated");
let generatedModuleCounter = 0;

async function loadGeneratedInputZod(entities: EntityModel[]) {
  generatedModuleCounter += 1;
  const generatedModulePath = join(
    generatedModuleDir,
    `input-zod-runtime-${generatedModuleCounter}.ts`,
  );
  mkdirSync(generatedModuleDir, { recursive: true });
  writeFileSync(generatedModulePath, generateInputZodModule(entities), "utf-8");
  return import(pathToFileURL(generatedModulePath).href) as Promise<{
    safeParseGraphqlInput: (
      name: string,
      value: unknown,
    ) =>
      | { ok: true; data: Record<string, unknown> }
      | { ok: false; userErrors: { message: string }[] };
    safeParseOptionalGraphqlInput: (
      name: string,
      value: unknown,
    ) => { ok: true; data: undefined } | { ok: false; userErrors: unknown[] };
    unwrapGraphqlInputParseResult: <T>(
      result: { ok: true; data: T } | { ok: false; userErrors: { message: string }[] },
    ) => T;
  }>;
}

const eventFixture: EntityModel = {
  ...itemFixture,
  exportName: "events",
  tableName: "events",
  graphqlType: "Event",
  fieldBasename: "event",
  listField: "events",
  columns: [
    ...itemFixture.columns,
    {
      drizzleKey: "startsAt",
      physicalName: "starts_at",
      graphqlName: "startsAt",
      kind: "timestamptz",
      notNull: true,
      hasDefault: false,
      comment: "Event start instant (UTC).",
      isServerManaged: false,
      isBusiness: true,
    },
  ],
};

describe("generateInputZodModule", () => {
  it("validates create input at runtime via emitted Zod schemas", async () => {
    const mod = await loadGeneratedInputZod([itemFixture]);

    const valid = mod.safeParseGraphqlInput("ItemCreateInput", { name: "widget" });
    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.data.name).toBe("widget");

    const invalid = mod.safeParseGraphqlInput("ItemCreateInput", { name: 42 });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.userErrors.length).toBeGreaterThan(0);
  });

  it("applies column constraint hints on create inputs", async () => {
    const withLength: EntityModel = {
      ...itemFixture,
      columns: itemFixture.columns.map((col) =>
        col.graphqlName === "name" ? { ...col, minLength: 2, maxLength: 80 } : col,
      ),
    };
    const mod = await loadGeneratedInputZod([withLength]);

    const tooShort = mod.safeParseGraphqlInput("ItemCreateInput", { name: "x" });
    expect(tooShort.ok).toBe(false);

    const tooLong = mod.safeParseGraphqlInput("ItemCreateInput", {
      name: "x".repeat(81),
    });
    expect(tooLong.ok).toBe(false);

    const ok = mod.safeParseGraphqlInput("ItemCreateInput", { name: "ab" });
    expect(ok.ok).toBe(true);
  });

  it("validates DAL scalar columns via dalScalarZod at runtime", async () => {
    const mod = await loadGeneratedInputZod([eventFixture]);

    const valid = mod.safeParseGraphqlInput("EventCreateInput", {
      name: "launch",
      startsAt: "2026-09-21T12:00:00.000Z",
    });
    expect(valid.ok).toBe(true);

    const invalid = mod.safeParseGraphqlInput("EventCreateInput", {
      name: "launch",
      startsAt: "not-a-datetime",
    });
    expect(invalid.ok).toBe(false);
  });

  it("applies numeric check hints on smallint create inputs", async () => {
    const withQty: EntityModel = {
      ...itemFixture,
      columns: [
        ...itemFixture.columns,
        {
          drizzleKey: "qty",
          physicalName: "qty",
          graphqlName: "qty",
          kind: "smallint",
          notNull: true,
          hasDefault: false,
          minInclusive: 5,
          comment: "Minimum order quantity.",
          isServerManaged: false,
          isBusiness: true,
        },
      ],
    };
    const mod = await loadGeneratedInputZod([withQty]);

    expect(mod.safeParseGraphqlInput("ItemCreateInput", { name: "x", qty: 4 }).ok).toBe(false);
    expect(mod.safeParseGraphqlInput("ItemCreateInput", { name: "x", qty: 5 }).ok).toBe(true);
  });

  it("returns GraphQL validation errors for optional filter parse failures", async () => {
    const mod = await loadGeneratedInputZod([itemFixture]);
    const optional = mod.safeParseOptionalGraphqlInput("ItemFilter", { name: 123 });
    expect(optional.ok).toBe(false);
    expect(() => mod.unwrapGraphqlInputParseResult(optional)).toThrow(GraphQLError);
  });
});
