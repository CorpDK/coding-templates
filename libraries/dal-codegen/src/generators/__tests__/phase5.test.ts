import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateColumnConstraints, type ColumnConstraintMeta } from "@corpdk/dal-core";
import { runDalCodegen } from "../../generate.js";
import { loadEntities } from "../../model.js";
import { columnGraphqlDescription } from "../schema-utils.js";
import { buildDalGraphQLSchema } from "../schema-builder.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureDir = join(packageRoot, "src/__tests__/fixtures/phase5-schema");
const codegenOutputDir = "src/__tests__/tmp-generated";
const dsPackageRoot = join(packageRoot, "../../templates/ds");
const dsSchemaPath = join(dsPackageRoot, "src/db/schema");

describe("Phase 5 dal-codegen", () => {
  it("infers maxLength and check constraints on columns", async () => {
    const entities = await loadEntities(fixtureDir, false);
    const widget = entities.find((e) => e.exportName === "phase5Widgets");
    expect(widget).toBeDefined();
    const codeCol = widget!.columns.find((c) => c.drizzleKey === "code");
    expect(codeCol?.maxLength).toBe(12);
    const qtyCol = widget!.columns.find((c) => c.drizzleKey === "qty");
    expect(qtyCol?.minExclusive).toBe(0);
    expect(columnGraphqlDescription(codeCol!)).toMatch(/max length 12/);
  });

  it("inferred column constraints reject invalid create input", async () => {
    const entities = await loadEntities(fixtureDir, false);
    const widget = entities.find((e) => e.exportName === "phase5Widgets")!;
    const constraints: ColumnConstraintMeta[] = widget.columns
      .filter((c) => c.isBusiness && (c.maxLength != null || c.minExclusive != null))
      .map((c) => ({
        graphqlName: c.graphqlName,
        drizzleKey: c.drizzleKey,
        ...(c.maxLength != null ? { maxLength: c.maxLength } : {}),
        ...(c.minExclusive != null ? { minExclusive: c.minExclusive } : {}),
      }));

    expect(() =>
      validateColumnConstraints({ code: "x".repeat(13), qty: 5, note: "ok" }, constraints, "create"),
    ).toThrow(/at most 12/);

    expect(() =>
      validateColumnConstraints({ code: "ABC", qty: 0, note: "ok" }, constraints, "create"),
    ).toThrow(/greater than 0/);
  });

  it("registers IntFilter when integer columns exist", async () => {
    const entities = await loadEntities(fixtureDir, false);
    const schema = buildDalGraphQLSchema(entities);
    expect(schema.getType("IntFilter")).toBeDefined();
    expect(schema.getType("Phase5WidgetField")).toBeDefined();
  });

  it("runDalCodegen emits repository and resolver artifacts for the fixture", async () => {
    await runDalCodegen({
      packageRoot,
      schemaPath: "src/__tests__/fixtures/phase5-schema",
      outputDir: codegenOutputDir,
      configPath: "dal.config.yaml",
    });

    const repoPath = join(
      packageRoot,
      codegenOutputDir,
      "repositories/generated-phase5Widget.repository.ts",
    );
    const resolverPath = join(packageRoot, codegenOutputDir, "resolvers/generated-resolvers.ts");
    const manifestPath = join(packageRoot, codegenOutputDir, "manifest.json");

    expect(existsSync(repoPath)).toBe(true);
    expect(existsSync(resolverPath)).toBe(true);
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      entities: Array<{ exportName: string; graphqlType: string }>;
    };
    expect(manifest.entities).toEqual([
      expect.objectContaining({ exportName: "phase5Widgets", graphqlType: "Phase5Widget" }),
    ]);

    const entities = await loadEntities(fixtureDir, false);
    const schema = buildDalGraphQLSchema(entities);
    const queryFields = schema.getQueryType()?.getFields() ?? {};
    expect(queryFields.phase5Widgets).toBeDefined();
    expect(queryFields.phase5Widget).toBeDefined();
    expect(queryFields.phase5WidgetConnection).toBeDefined();
  });

  it("runDalCodegen supports ds template relation navigation in GraphQL schema", async () => {
    await runDalCodegen({
      packageRoot: dsPackageRoot,
      schemaPath: "src/db/schema",
      outputDir: "src/__tests__/tmp-generated-ds",
      configPath: "dal.config.yaml",
    });

    const entities = await loadEntities(dsSchemaPath, false);
    const categories = entities.find((e) => e.exportName === "categories");
    const items = entities.find((e) => e.exportName === "items");
    expect(categories).toBeDefined();
    expect(items).toBeDefined();

    const categoryItems = categories!.relations.find((r) => r.fieldName === "items");
    expect(categoryItems?.kind).toBe("one-to-many");
    expect(categoryItems?.childFkDrizzleKey).toBe("categoryId");

    const schema = buildDalGraphQLSchema(entities);
    const categoryType = schema.getType("Category");
    const itemType = schema.getType("Item");
    expect(categoryType && "getFields" in categoryType).toBe(true);
    expect(itemType && "getFields" in itemType).toBe(true);
    if (categoryType && "getFields" in categoryType) {
      expect(categoryType.getFields().items).toBeDefined();
    }
    if (itemType && "getFields" in itemType) {
      expect(itemType.getFields().category).toBeDefined();
    }
  });
});
