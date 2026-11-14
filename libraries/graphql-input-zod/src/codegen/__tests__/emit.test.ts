import {
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { describe, expect, it } from "vitest";
import { z, type ZodTypeAny } from "zod";
import { emitGraphqlInputZodBlocks } from "../emit-graphql-input-blocks.js";

function asEvaluableSource(blocks: string[]): string {
  return blocks
    .map((block) =>
      block
        .replace(/\bexport const\b/g, "const")
        .replace(/^export type \w+.*$/gm, "")
        .replace(/ as const;/g, ";"),
    )
    .join("\n\n");
}

function loadExportedSchema(
  blocks: string[],
  exportName: string,
  scalarRegistryBlocks?: string[],
): ZodTypeAny {
  const schemaBlocks = blocks.filter((line) => !line.startsWith("import "));
  const prelude = scalarRegistryBlocks?.length
    ? asEvaluableSource(scalarRegistryBlocks)
    : "";
  const body = `${prelude}\n${asEvaluableSource(schemaBlocks)}\nreturn ${exportName};`;
  const factory = new Function("z", body) as (z: typeof import("zod").z) => ZodTypeAny;
  return factory(z);
}

function schemaWithIdField(builtinIdExpr?: string) {
  const Query = new GraphQLObjectType({
    name: "Query",
    fields: { _: { type: GraphQLString, resolve: () => null } },
  });
  const ById = new GraphQLInputObjectType({
    name: "ByBuiltinId",
    fields: { id: { type: GraphQLID } },
  });
  return emitGraphqlInputZodBlocks(new GraphQLSchema({ query: Query, types: [ById] }), {
    builtinScalars: builtinIdExpr ? { ID: builtinIdExpr } : undefined,
    scalarReferences: "inline",
  });
}

describe("emitGraphqlInputZodBlocks", () => {
  it("uses spec default ID (non-UUID strings allowed)", () => {
    const spec = schemaWithIdField();
    const schema = loadExportedSchema(spec.schemaBlocks, "ByBuiltinIdSchema");
    expect(schema.safeParse({ id: "not-a-uuid" }).success).toBe(true);
    expect(schema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(
      true,
    );
  });

  it("honors DAL ID override", () => {
    const dal = schemaWithIdField("z.string().uuid()");
    const schema = loadExportedSchema(dal.schemaBlocks, "ByBuiltinIdSchema");
    expect(schema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    expect(schema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(
      true,
    );
  });

  it("registry mode references scalarZodSchemas object", () => {
    const Custom = new GraphQLScalarType({ name: "CustomDate", serialize: (v) => v });
    const Query = new GraphQLObjectType({
      name: "Query",
      fields: { _: { type: GraphQLString, resolve: () => null } },
    });
    const Payload = new GraphQLInputObjectType({
      name: "Payload",
      fields: { when: { type: Custom } },
    });
    const emitted = emitGraphqlInputZodBlocks(
      new GraphQLSchema({ query: Query, types: [Custom, Payload] }),
      {
        scalars: { CustomDate: "z.string().min(1)" },
        scalarReferences: "registry",
      },
    );
    const schema = loadExportedSchema(
      emitted.schemaBlocks,
      "PayloadSchema",
      emitted.scalarRegistryBlocks,
    );
    expect(schema.safeParse({ when: "2020-01-01" }).success).toBe(true);
    expect(schema.safeParse({ when: "" }).success).toBe(false);
  });

  it("prepends preamble to schema blocks", () => {
    const Query = new GraphQLObjectType({
      name: "Query",
      fields: { _: { type: GraphQLString, resolve: () => null } },
    });
    const ById = new GraphQLInputObjectType({
      name: "ByBuiltinId",
      fields: { id: { type: GraphQLID } },
    });
    const withPreamble = emitGraphqlInputZodBlocks(
      new GraphQLSchema({ query: Query, types: [ById] }),
      {
        preamble: 'import { zPgInt32 } from "@corpdk/scalar-zod/pg";',
        scalarReferences: "inline",
      },
    );
    expect(withPreamble.schemaBlocks[0]).toBe(
      'import { zPgInt32 } from "@corpdk/scalar-zod/pg";',
    );
  });
});