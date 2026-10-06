import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { GraphQLError } from "graphql";
import { generateInputZodModule } from "../input-zod.js";
import { itemFixture } from "./sdl.fixture.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const generatedModuleDir = join(packageRoot, "src/__tests__/tmp-generated");
let generatedModuleCounter = 0;

async function loadGeneratedInputZod(entities: typeof itemFixture[]) {
  generatedModuleCounter += 1;
  const generatedModulePath = join(
    generatedModuleDir,
    `input-zod-runtime-${generatedModuleCounter}.ts`,
  );
  mkdirSync(generatedModuleDir, { recursive: true });
  writeFileSync(generatedModulePath, generateInputZodModule(entities), "utf-8");
  return import(pathToFileURL(generatedModulePath).href) as Promise<{
    safeParseGraphqlInput: (
      name: "ItemCreateInput",
      value: unknown,
    ) =>
      | { ok: true; data: { name: string } }
      | { ok: false; userErrors: { message: string }[] };
    safeParseOptionalGraphqlInput: (
      name: "ItemFilter",
      value: unknown,
    ) => { ok: true; data: undefined } | { ok: false; userErrors: unknown[] };
    unwrapGraphqlInputParseResult: <T>(
      result: { ok: true; data: T } | { ok: false; userErrors: { message: string }[] },
    ) => T;
    inputZodSchemas: Record<string, { parse: (v: unknown) => unknown }>;
  }>;
}

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
    const withLength: typeof itemFixture = {
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

  it("returns GraphQL validation errors for optional filter parse failures", async () => {
    const mod = await loadGeneratedInputZod([itemFixture]);
    const optional = mod.safeParseOptionalGraphqlInput("ItemFilter", { name: 123 });
    expect(optional.ok).toBe(false);
    expect(() => mod.unwrapGraphqlInputParseResult(optional)).toThrow(GraphQLError);
  });
});
