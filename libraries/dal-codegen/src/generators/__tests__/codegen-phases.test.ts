import { existsSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { runDalCodegenImpl, runDalCodegenSchema } from "../../generate.js";
import { loadEntities } from "../../model.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const schemaRel = "src/__tests__/fixtures/phase5-schema";
const schemaPhaseDir = "src/__tests__/tmp-phase1-only";
const implOutputDir = "src/__tests__/tmp-phase3-only";
const schemaPhaseEntityRecords = `${schemaPhaseDir}/entity-records.ts`;
const implEntityRecords = "src/__tests__/entity-records.ts";

describe("3-phase dal-codegen outputs", () => {
  it("schema phase emits mappers wired to entity-records Record types", async () => {
    const entities = await loadEntities(join(packageRoot, schemaRel), false);

    await runDalCodegenSchema({
      packageRoot,
      schemaPath: schemaRel,
      outputDir: `${schemaPhaseDir}/dal`,
      schemaOutputPath: `${schemaPhaseDir}/generated-schema.ts`,
      entityRecordsOutputPath: schemaPhaseEntityRecords,
      mappersOutputPath: `${schemaPhaseDir}/graphql-codegen.mappers.ts`,
      configPath: "dal.config.yaml",
    });

    const mappersUrl = pathToFileURL(
      join(packageRoot, schemaPhaseDir, "graphql-codegen.mappers.ts"),
    ).href;
    const { graphqlCodegenMappers } = await import(mappersUrl);

    for (const entity of entities) {
      expect(graphqlCodegenMappers[entity.graphqlType as keyof typeof graphqlCodegenMappers]).toBe(
        `../entity-records.js#${entity.graphqlType}Record`,
      );
    }
    for (const target of Object.values(graphqlCodegenMappers)) {
      expect(target).toMatch(/^\.\.\/entity-records\.js#/);
      expect(target).not.toMatch(/repositories/);
    }

    const recordsUrl = pathToFileURL(join(packageRoot, schemaPhaseEntityRecords)).href;
    await expect(import(recordsUrl)).resolves.toBeDefined();

    rmSync(join(packageRoot, schemaPhaseDir), { recursive: true, force: true });
  });

  it("schema phase does not wipe sibling dal output dir marker", async () => {
    const dalMarkerDir = join(packageRoot, schemaPhaseDir, "dal");
    mkdirSync(dalMarkerDir, { recursive: true });
    const marker = join(dalMarkerDir, "keep.txt");
    writeFileSync(marker, "ok", "utf-8");

    await runDalCodegenSchema({
      packageRoot,
      schemaPath: schemaRel,
      outputDir: `${schemaPhaseDir}/dal`,
      schemaOutputPath: `${schemaPhaseDir}/generated-schema.ts`,
      entityRecordsOutputPath: `${schemaPhaseDir}/entity-records.ts`,
      mappersOutputPath: `${schemaPhaseDir}/graphql-codegen.mappers.ts`,
      configPath: "dal.config.yaml",
    });

    expect(existsSync(marker)).toBe(true);
    expect(existsSync(join(packageRoot, schemaPhaseDir, "entity-records.ts"))).toBe(true);
    expect(existsSync(join(packageRoot, schemaPhaseDir, "graphql-codegen.mappers.ts"))).toBe(
      true,
    );
    expect(existsSync(join(packageRoot, schemaPhaseDir, "generated-schema.ts"))).toBe(true);

    rmSync(join(packageRoot, schemaPhaseDir), { recursive: true, force: true });
  });

  it("impl phase writes dal artifacts and omits mappers in outputDir", async () => {
    await runDalCodegenSchema({
      packageRoot,
      schemaPath: schemaRel,
      outputDir: `${implOutputDir}/unused-dal`,
      schemaOutputPath: "src/__tests__/unused-schema-for-impl.ts",
      entityRecordsOutputPath: implEntityRecords,
      mappersOutputPath: "src/__tests__/unused-mappers-for-impl.ts",
      configPath: "dal.config.yaml",
    });

    await runDalCodegenImpl({
      packageRoot,
      schemaPath: schemaRel,
      outputDir: implOutputDir,
      schemaOutputPath: "src/__tests__/unused-schema.ts",
      configPath: "dal.config.yaml",
    });

    const out = join(packageRoot, implOutputDir);
    expect(existsSync(join(out, "repositories/generated-phase5ConstraintFixture.repository.ts"))).toBe(
      true,
    );
    expect(existsSync(join(out, "resolvers/generated-resolvers.ts"))).toBe(true);
    expect(existsSync(join(out, "graphql-codegen.mappers.ts"))).toBe(false);

    const resolverUrl = pathToFileURL(join(out, "resolvers/generated-resolvers.ts")).href;
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

    rmSync(out, { recursive: true, force: true });
    rmSync(join(packageRoot, implEntityRecords), { force: true });
    rmSync(join(packageRoot, "src/__tests__/unused-schema-for-impl.ts"), { force: true });
    rmSync(join(packageRoot, "src/__tests__/unused-mappers-for-impl.ts"), { force: true });
  });
});
