import {
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { describe, expect, it } from "vitest";
import { emitGraphqlInputZodBlocks } from "../emit-graphql-input-blocks.js";

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
  });
}

describe("emitGraphqlInputZodBlocks", () => {
  it("uses spec default ID (non-UUID strings allowed)", () => {
    const spec = schemaWithIdField();
    const source = spec.schemaBlocks.join("\n");
    expect(source).toContain("z.string()");
    expect(source).not.toContain("uuid");
  });

  it("honors DAL ID override", () => {
    const dal = schemaWithIdField("z.string().uuid()");
    expect(dal.schemaBlocks.join("\n")).toContain("uuid");
  });
});