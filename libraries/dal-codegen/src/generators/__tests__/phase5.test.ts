import { describe, expect, it } from "vitest";
import { loadEntities } from "../../model.js";
import { generateRepository } from "../repository.js";
import { columnGraphqlDescription } from "../schema-utils.js";
import { buildDalGraphQLSchema } from "../schema-builder.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../../__tests__/fixtures/phase5-schema");

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

  it("emits repository constraint validation and extended scalar imports", async () => {
    const entities = await loadEntities(fixtureDir, false);
    const widget = entities.find((e) => e.exportName === "phase5Widgets")!;
    const repo = generateRepository(widget, entities, {
      strict: false,
      filterMaxDepth: 2,
      filterMaxNodes: 50,
    });
    expect(repo).toContain("validateColumnConstraints");
    expect(repo).toContain("COLUMN_CONSTRAINTS");
    expect(repo).toContain('mapDriverError(err, "postgresql")');
    expect(repo).toContain("maxLength: 12");
  });

  it("registers IntFilter when integer columns exist", async () => {
    const entities = await loadEntities(fixtureDir, false);
    const schema = buildDalGraphQLSchema(entities);
    expect(schema.getType("IntFilter")).toBeDefined();
    expect(schema.getType("Phase5WidgetField")).toBeDefined();
  });
});
