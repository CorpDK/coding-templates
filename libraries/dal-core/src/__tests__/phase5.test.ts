import { describe, expect, it } from "vitest";
import {
  collectEntityFieldSelection,
  extractDriverErrorDetails,
  mapDriverError,
  validateColumnConstraints,
  buildIntFilter,
  buildDateFilter,
  parseBigInt,
  parseDate,
  parseDateTime,
  parseDecimal,
  parseIntervalMs,
  parseTimeTz,
  resolveActorId,
  serializeBigInt,
  serializeDate,
  serializeDateTime,
  serializeDecimal,
  serializeIntervalMs,
  serializeTimeTz,
  toGraphqlFieldBasename,
  toGraphqlFieldName,
  toGraphqlListField,
  toGraphqlTypeName,
} from "@corpdk/dal-core";
import { GraphQLObjectType, GraphQLSchema, GraphQLString, parse } from "graphql";
import type { GraphQLResolveInfo } from "graphql";
import { integer, pgTable, uuid, date } from "drizzle-orm/pg-core";

describe("SQLSTATE driver mappers (P1)", () => {
  it("maps PostgreSQL unique violation 23505", () => {
    const err = Object.assign(new Error("duplicate"), { code: "23505" });
    expect(mapDriverError(err, "postgresql").code).toBe("UNIQUE_VIOLATION");
  });

  it("maps PostgreSQL FK violation 23503", () => {
    const err = { code: "23503", message: "fk" };
    expect(mapDriverError(err, "postgresql").code).toBe("FK_VIOLATION");
  });

  it("maps check constraint 23514", () => {
    const err = { code: "23514", message: "check" };
    expect(mapDriverError(err, "postgresql").code).toBe("CONSTRAINT_VIOLATION");
  });

  it("walks error.cause for nested driver errors", () => {
    const cause = { code: "23505", message: "dup" };
    const err = new Error("wrapper", { cause });
    expect(extractDriverErrorDetails(err).code).toBe("23505");
  });

  it("falls back to message heuristic without code", () => {
    expect(mapDriverError(new Error("duplicate key value")).code).toBe("UNIQUE_VIOLATION");
  });

  it("maps MySQL duplicate and FK codes", () => {
    expect(mapDriverError({ code: "ER_DUP_ENTRY", message: "dup" }, "mysql").code).toBe(
      "UNIQUE_VIOLATION",
    );
    expect(mapDriverError({ code: "ER_NO_REFERENCED_ROW_2", message: "fk" }, "mysql").code).toBe(
      "FK_VIOLATION",
    );
    expect(
      mapDriverError({ code: "SQLITE_CONSTRAINT_CHECK", message: "check" }, "sqlite").code,
    ).toBe("CONSTRAINT_VIOLATION");
  });
});

describe("Column constraints (P2)", () => {
  it("rejects strings over maxLength", () => {
    expect(() =>
      validateColumnConstraints(
        { name: "x".repeat(11) },
        [{ graphqlName: "name", drizzleKey: "name", maxLength: 10 }],
        "create",
      ),
    ).toThrow(/at most 10/);
  });

  it("enforces minExclusive from inferred checks", () => {
    expect(() =>
      validateColumnConstraints(
        { qty: 0 },
        [{ graphqlName: "qty", drizzleKey: "qty", minExclusive: 0 }],
        "create",
      ),
    ).toThrow(/greater than 0/);
  });
});

describe("GraphQL fragment projection (P3)", () => {
  const ItemType = new GraphQLObjectType({
    name: "Item",
    fields: {
      id: { type: GraphQLString },
      name: { type: GraphQLString },
      sku: { type: GraphQLString },
    },
  });
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: {
        items: { type: ItemType, resolve: () => ({}) },
      },
    }),
  });

  it("resolves named fragment spreads on list selections", () => {
    const doc = parse(`
      query Q {
        items {
          ...ItemCore
        }
      }
      fragment ItemCore on Item {
        id
        name
      }
    `);
    const op = doc.definitions[0];
    if (op.kind !== "OperationDefinition" || !op.selectionSet) throw new Error("bad doc");
    const itemsField = op.selectionSet.selections[0];
    if (itemsField.kind !== "Field") throw new Error("bad field");
    const info = {} as GraphQLResolveInfo;
    Object.assign(info, {
      fieldNodes: [itemsField],
      schema,
      fragments: Object.fromEntries(
        doc.definitions
          .filter((d) => d.kind === "FragmentDefinition")
          .map((d) => [d.name.value, d]),
      ),
    });
    expect(collectEntityFieldSelection(info, "Item")).toEqual(new Set(["id", "name"]));
  });
});

describe("PostgreSQL type filters and scalars (P5)", () => {
  const table = pgTable("metrics", {
    id: uuid("id").primaryKey(),
    qty: integer("qty").notNull(),
    effectiveOn: date("effective_on").notNull(),
  });

  it("buildIntFilter compiles eq", () => {
    const sql = buildIntFilter(table.qty, { eq: 3 });
    expect(sql).toBeDefined();
  });

  it("parseBigInt and serializeDate round-trip wire formats", () => {
    expect(parseBigInt("9223372036854775807")).toBe("9223372036854775807");
    expect(serializeDate("2026-09-21")).toBe("2026-09-21");
    expect(parseDate("2026-09-21")).toBe("2026-09-21");
    expect(serializeDateTime(new Date("2026-09-21T12:00:00.000Z"))).toBe("2026-09-21T12:00:00.000Z");
    expect(parseDateTime("2026-09-21T12:00:00.000Z").toISOString()).toBe("2026-09-21T12:00:00.000Z");
    expect(serializeTimeTz("12:30:00Z")).toBe("12:30:00Z");
    expect(parseTimeTz("12:30:00+05:30")).toBe("12:30:00+05:30");
    expect(serializeBigInt(42n)).toBe("42");
    expect(serializeDecimal("12.5")).toBe("12.5");
    expect(parseDecimal("12.5")).toBe("12.5");
    expect(serializeIntervalMs(1500)).toBe("1500");
    expect(parseIntervalMs("1500")).toBe("1500");
    expect(resolveActorId("  alice ")).toBe("alice");
    expect(resolveActorId(undefined)).toBe("system");
  });

  it("maps Drizzle export and column names to GraphQL conventions", () => {
    expect(toGraphqlTypeName("categories")).toBe("Category");
    expect(toGraphqlTypeName("companies")).toBe("Company");
    expect(toGraphqlFieldBasename("items")).toBe("item");
    expect(toGraphqlListField("items")).toBe("items");
    expect(toGraphqlFieldName("isActive", "is_active")).toBe("isActive");
    expect(toGraphqlFieldName("hasTags", "has_tags")).toBe("hasTags");
    expect(toGraphqlFieldName("sku", "sku")).toBe("sku");
  });

  it("buildDateFilter compiles range operators", () => {
    const sqlFrag = buildDateFilter(table.effectiveOn, { gte: "2026-01-01" });
    expect(sqlFrag).toBeDefined();
  });
});
