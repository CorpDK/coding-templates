import { join, dirname as pathDirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { runDalCodegen } from "../../generate.js";
import { loadEntities } from "../../model.js";
import { buildDalGraphQLSchema } from "../schema-builder.js";

const packageRoot = join(pathDirname(fileURLToPath(import.meta.url)), "../../..");
const m2mFixtureDir = join(packageRoot, "src/__tests__/fixtures/m2m-schema");
const m2mRunDir = "src/__tests__/tmp-generated-m2m";
const m2mOutputDir = `${m2mRunDir}/dal`;
const testEntityRecords = `${m2mRunDir}/entity-records.ts`;

describe("many-to-many navigation", () => {
  it("infers pure junction tables as many-to-many to the far target", async () => {
    const entities = await loadEntities(m2mFixtureDir, false);
    const usersEntity = entities.find((e) => e.exportName === "users");
    expect(usersEntity).toBeDefined();
    const labelsRel = usersEntity!.relations.find((r) => r.fieldName === "labels");
    expect(labelsRel?.kind).toBe("many-to-many");
    expect(labelsRel?.joinTableExportName).toBe("userLabels");
    expect(labelsRel?.targetExportName).toBe("labels");
  });

  it("exposes M:N navigation on the GraphQL schema", async () => {
    const entities = await loadEntities(m2mFixtureDir, false);
    const schema = buildDalGraphQLSchema(entities);
    const userType = schema.getType("User");
    expect(userType && "getFields" in userType).toBe(true);
    if (!userType || !("getFields" in userType)) return;
    const labelsField = userType.getFields().labels;
    expect(labelsField).toBeDefined();
    expect(labelsField.type.toString()).toMatch(/\[Label!/);
  });

  it("runDalCodegen wires M:N loaders and resolver navigation", async () => {
    await runDalCodegen({
      packageRoot,
      schemaPath: "src/__tests__/fixtures/m2m-schema",
      outputDir: m2mOutputDir,
      schemaOutputPath: "src/__tests__/tmp-generated-m2m-schema.ts",
      entityRecordsOutputPath: testEntityRecords,
      mappersOutputPath: "src/__tests__/tmp-generated-m2m-mappers.ts",
      configPath: "dal.config.yaml",
    });

    const resolverUrl = pathToFileURL(
      join(packageRoot, m2mOutputDir, "resolvers/generated-resolvers.ts"),
    ).href;

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
    expect(ctx.loaders.user_labels).toBeDefined();

    const labels = await generatedResolvers.User.labels({ id: "user-1" }, {}, ctx);
    expect(labels).toEqual([]);
  });
});
