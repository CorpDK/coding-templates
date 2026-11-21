import { describe, expect, it } from "vitest";
import { parse, validate } from "graphql";
import { buildOperationDocument, emitCliModules } from "../index.js";
import { loadDalSchema } from "./helpers.js";

function cmd(schema: ReturnType<typeof loadDalSchema>, field: string) {
  const result = emitCliModules(schema, {
    bin: "ds-cli",
    man: { enabled: false },
  });
  return result.commands.find((c) => c.field === field)!;
}

describe("DAL golden selections", () => {
  const schema = loadDalSchema();

  it("generates 166 operations", () => {
    const { commands } = emitCliModules(schema, { man: { enabled: false } });
    expect(commands).toHaveLength(166);
  });

  it("createItem selection shape", () => {
    const op = cmd(schema, "createItem");
    expect(op.selection.item).toMatchObject({
      id: true,
      name: true,
      category: { id: true },
      detail: { id: true },
      itemTags: { id: true },
      orderLines: { id: true },
    });
    expect(op.selection.userErrors).toMatchObject({
      code: true,
      field: true,
      id: true,
      message: true,
    });
  });

  it("marks arguments with defaults as optional in catalog", () => {
    const op = cmd(schema, "item");
    const includeDeleted = op.args.find((a) => a.name === "includeDeleted");
    expect(includeDeleted?.required).toBe(false);
  });

  it("order selection shape", () => {
    const op = cmd(schema, "order");
    expect(op.selection).toMatchObject({
      id: true,
      customerName: true,
      lines: { id: true },
      user: { id: true },
    });
  });

  it("itemConnection selection shape", () => {
    const op = cmd(schema, "itemConnection");
    expect(op.selection).toMatchObject({
      nodes: expect.objectContaining({ id: true, name: true }),
      pageInfo: {
        endCursor: true,
        hasNextPage: true,
        hasPreviousPage: true,
        startCursor: true,
      },
    });
    expect(op.selection).not.toHaveProperty("edges");
  });

  it("bulkCreateItem union fragments", () => {
    const op = cmd(schema, "bulkCreateItem");
    expect(op.selection).toMatchObject({
      __typename: true,
      on_BulkMutationResult: {
        failureCount: true,
        successCount: true,
        userErrors: {
          code: true,
          field: true,
          id: true,
          message: true,
        },
      },
      on_ItemListPayload: {
        items: expect.objectContaining({ id: true }),
      },
    });
  });

  it("itemChanged subscription", () => {
    const op = cmd(schema, "itemChanged");
    expect(op.selection).toEqual({
      count: true,
      ids: true,
      isTruncated: true,
      operation: true,
    });
  });

  it("status query", () => {
    const op = cmd(schema, "status");
    expect(op.selection).toEqual({ ok: true, timestamp: true });
  });

  it("hello scalar root has empty selection", () => {
    const op = cmd(schema, "hello");
    expect(op.selection).toEqual({});
  });

  it("all operations produce valid GraphQL documents under 4KB", () => {
    const { commands } = emitCliModules(schema, { man: { enabled: false } });
    let total = 0;
    for (const op of commands) {
      const root =
        op.kind === "query"
          ? schema.getQueryType()
          : op.kind === "mutation"
            ? schema.getMutationType()
            : schema.getSubscriptionType();
      const doc = buildOperationDocument(
        schema,
        op.kind,
        op.field,
        op.args,
        op.selection,
        root!.getFields()[op.field].type,
      );
      const bytes = Buffer.byteLength(doc, "utf8");
      total += bytes;
      const errors = validate(schema, parse(doc));
      expect(errors, `validate ${op.field}`).toEqual([]);
      expect(bytes).toBeLessThan(4096);
    }
    expect(total).toBeGreaterThan(30_000);
    expect(total).toBeLessThan(55_000);
  });
});
