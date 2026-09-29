import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateColumnConstraints, type ColumnConstraintMeta } from "@corpdk/dal-core";
import { runDalCodegen } from "../../generate.js";
import { loadEntities } from "../../model.js";
import { columnGraphqlDescription } from "../schema-utils.js";
import { buildDalGraphQLSchema } from "../schema-builder.js";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureDir = join(packageRoot, "src/__tests__/fixtures/phase5-schema");
const codegenOutputDir = "src/__tests__/tmp-generated";
const dsPackageRoot = join(packageRoot, "../../templates/ds");
const dsSchemaPath = join(dsPackageRoot, "src/db/schema");

function constraintMetaFromEntity(
  entity: NonNullable<Awaited<ReturnType<typeof loadEntities>>[number]>,
): ColumnConstraintMeta[] {
  return entity.columns
    .filter(
      (c) =>
        c.isBusiness &&
        (c.maxLength != null ||
          c.minLength != null ||
          c.minExclusive != null ||
          c.minInclusive != null),
    )
    .map((c) => ({
      graphqlName: c.graphqlName,
      drizzleKey: c.drizzleKey,
      ...(c.maxLength != null ? { maxLength: c.maxLength } : {}),
      ...(c.minLength != null ? { minLength: c.minLength } : {}),
      ...(c.minExclusive != null ? { minExclusive: c.minExclusive } : {}),
      ...(c.minInclusive != null ? { minInclusive: c.minInclusive } : {}),
    }));
}

describe("Phase 5 dal-codegen", () => {
  it("infers maxLength, minLength, and check constraints on commerce schema columns", async () => {
    const entities = await loadEntities(dsSchemaPath, false);
    const tags = entities.find((e) => e.exportName === "tags");
    const orderLines = entities.find((e) => e.exportName === "orderLines");
    expect(tags).toBeDefined();
    expect(orderLines).toBeDefined();

    const labelCol = tags!.columns.find((c) => c.drizzleKey === "label");
    expect(labelCol?.maxLength).toBe(30);
    expect(labelCol?.minLength).toBe(2);
    expect(columnGraphqlDescription(labelCol!)).toMatch(/max length 30/);
    expect(columnGraphqlDescription(labelCol!)).toMatch(/min length 2/);

    const quantityCol = orderLines!.columns.find((c) => c.drizzleKey === "quantity");
    expect(quantityCol?.minExclusive).toBe(0);
  });

  it("inferred column constraints reject invalid create input", async () => {
    const entities = await loadEntities(dsSchemaPath, false);
    const tags = entities.find((e) => e.exportName === "tags")!;
    const orderLines = entities.find((e) => e.exportName === "orderLines")!;

    const tagConstraints = constraintMetaFromEntity(tags);
    expect(() =>
      validateColumnConstraints({ label: "x".repeat(31) }, tagConstraints, "create"),
    ).toThrow(/at most 30/);
    expect(() => validateColumnConstraints({ label: "x" }, tagConstraints, "create")).toThrow(
      /at least 2/,
    );

    const lineConstraints = constraintMetaFromEntity(orderLines);
    expect(() =>
      validateColumnConstraints({ quantity: 0 }, lineConstraints, "create"),
    ).toThrow(/greater than 0/);
  });

  it("infers constraints on isolated phase5 fixture entity", async () => {
    const entities = await loadEntities(fixtureDir, false);
    const fixture = entities.find((e) => e.exportName === "phase5ConstraintFixtures");
    expect(fixture).toBeDefined();
    const labelCol = fixture!.columns.find((c) => c.drizzleKey === "label");
    expect(labelCol?.maxLength).toBe(30);
    expect(labelCol?.minLength).toBe(2);
    const quantityCol = fixture!.columns.find((c) => c.drizzleKey === "quantity");
    expect(quantityCol?.minExclusive).toBe(0);
  });

  it("registers IntFilter when integer columns exist", async () => {
    const entities = await loadEntities(fixtureDir, false);
    const schema = buildDalGraphQLSchema(entities);
    expect(schema.getType("IntFilter")).toBeDefined();
    expect(schema.getType("Phase5ConstraintFixtureField")).toBeDefined();
  });

  it("runDalCodegen emits repository and resolver artifacts for the fixture", async () => {
    await runDalCodegen({
      packageRoot,
      schemaPath: "src/__tests__/fixtures/phase5-schema",
      outputDir: codegenOutputDir,
      schemaOutputPath: "src/__tests__/tmp-generated-schema.ts",
      entityRecordsOutputPath: "src/__tests__/tmp-entity-records.ts",
      mappersOutputPath: "src/__tests__/tmp-graphql-codegen.mappers.ts",
      configPath: "dal.config.yaml",
    });

    const repoPath = join(
      packageRoot,
      codegenOutputDir,
      "repositories/generated-phase5ConstraintFixture.repository.ts",
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
      expect.objectContaining({
        exportName: "phase5ConstraintFixtures",
        graphqlType: "Phase5ConstraintFixture",
      }),
    ]);

    const resolverUrl = pathToFileURL(resolverPath).href;
    const { createDalContext, generatedResolvers } = await import(resolverUrl);

    const pubsub = {
      publish: () => undefined,
      subscribe: () =>
        ({
          [Symbol.asyncIterator]: async function* empty() {
            yield await Promise.resolve(undefined);
          },
        }) as AsyncIterable<unknown>,
    };

    const ctx = createDalContext(pubsub as never);
    expect(ctx.repositories.phase5ConstraintFixture).toBeDefined();

    const missing = await generatedResolvers.Query.phase5ConstraintFixture(
      {},
      { id: "550e8400-e29b-41d4-a716-446655440000" },
      ctx,
      undefined as never,
    );
    expect(missing).toBeNull();

    const invalidCreate = await generatedResolvers.Mutation.createPhase5ConstraintFixture(
      {},
      { input: { label: "x".repeat(31), quantity: 5, note: "ok" } },
      ctx,
    );
    expect(invalidCreate.userErrors.length).toBeGreaterThan(0);
    expect(invalidCreate.phase5ConstraintFixture).toBeNull();
  });

  it("runDalCodegen supports ds template relation navigation in GraphQL schema", async () => {
    await runDalCodegen({
      packageRoot: dsPackageRoot,
      schemaPath: "src/db/schema",
      outputDir: "src/__tests__/tmp-generated-ds",
      schemaOutputPath: "src/__tests__/tmp-generated-ds-schema.ts",
      entityRecordsOutputPath: "src/__tests__/tmp-generated-ds-entity-records.ts",
      mappersOutputPath: "src/__tests__/tmp-generated-ds-mappers.ts",
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
