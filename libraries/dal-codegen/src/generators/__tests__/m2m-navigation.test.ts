import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDalCodegen } from "../../generate.js";
import { loadEntities } from "../../model.js";
import { buildDalGraphQLSchema } from "../schema-builder.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const m2mFixtureDir = join(packageRoot, "src/__tests__/fixtures/m2m-schema");
const m2mOutputDir = "src/__tests__/tmp-generated-m2m";

describe("many-to-many navigation", () => {
  it("infers pure junction tables as many-to-many to the far target", async () => {
    const entities = await loadEntities(m2mFixtureDir, false);
    const users = entities.find((e) => e.exportName === "demoUsers");
    expect(users).toBeDefined();
    const tagsRel = users!.relations.find((r) => r.fieldName === "tags");
    expect(tagsRel?.kind).toBe("many-to-many");
    expect(tagsRel?.joinTableExportName).toBe("demoUserTags");
    expect(tagsRel?.targetExportName).toBe("demoTags");
  });

  it("exposes M:N navigation on the GraphQL schema", async () => {
    const entities = await loadEntities(m2mFixtureDir, false);
    const schema = buildDalGraphQLSchema(entities);
    const userType = schema.getType("DemoUser");
    expect(userType && "getFields" in userType).toBe(true);
    if (!userType || !("getFields" in userType)) return;
    const tagsField = userType.getFields().tags;
    expect(tagsField).toBeDefined();
    expect(tagsField.type.toString()).toMatch(/\[DemoTag!/);
  });

  it("runDalCodegen emits M:N repositories and manifest entries", async () => {
    await runDalCodegen({
      packageRoot,
      schemaPath: "src/__tests__/fixtures/m2m-schema",
      outputDir: m2mOutputDir,
      configPath: "dal.config.yaml",
    });

    const manifestPath = join(packageRoot, m2mOutputDir, "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      entities: Array<{ exportName: string; graphqlType: string }>;
    };
    expect(manifest.entities.map((e) => e.exportName).sort()).toEqual([
      "demoTags",
      "demoUserTags",
      "demoUsers",
    ]);
    expect(manifest.entities.find((e) => e.exportName === "demoUsers")?.graphqlType).toBe("DemoUser");
  });
});
