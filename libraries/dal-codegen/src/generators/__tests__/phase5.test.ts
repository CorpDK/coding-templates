import { describe, expect, it } from "vitest";
import { validateColumnConstraints, type ColumnConstraintMeta } from "@corpdk/dal-core";
import { loadEntities } from "../../model.js";
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
});
