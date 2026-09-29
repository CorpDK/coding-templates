import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDalCodegenImpl, runDalCodegenSchema } from "../../generate.js";
import { generateGraphqlCodegenMappersModule } from "../graphql-mappers.js";
import { generateEntityRecordsModule } from "../entity-records.js";
import { loadEntities } from "../../model.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const schemaRel = "src/__tests__/fixtures/phase5-schema";
const schemaPhaseDir = "src/__tests__/tmp-phase1-only";
const implOutputDir = "src/__tests__/tmp-phase3-only";

describe("3-phase dal-codegen outputs", () => {
  it("mappers reference entity-records, not repository files", async () => {
    const entities = await loadEntities(join(packageRoot, schemaRel), false);
    const mappers = generateGraphqlCodegenMappersModule(entities);
    expect(mappers).toContain('../entity-records.js#Phase5ConstraintFixtureRecord');
    expect(mappers).not.toContain("repositories/generated");
  });

  it("entity-records module defines Record types from EntityModel", async () => {
    const entities = await loadEntities(join(packageRoot, schemaRel), false);
    const module = generateEntityRecordsModule(entities);
    expect(module).toMatch(/export type Phase5ConstraintFixtureRecord = \{/);
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

    const repo = readFileSync(
      join(out, "repositories/generated-phase5ConstraintFixture.repository.ts"),
      "utf-8",
    );
    expect(repo).toContain('from "../../entity-records.js"');
    expect(repo).not.toMatch(/export type Phase5ConstraintFixtureRecord = \{/);

    rmSync(out, { recursive: true, force: true });
  });
});
