import { buildSchema } from "graphql";
import { emitDslModules } from "../../src/codegen/emitDslModules.js";
import { linkTypeMap } from "../../src/runtime/linkTypeMap.js";

export const minimalSchema = buildSchema(/* GraphQL */ `
  type Query {
    hello(name: String): String!
    items(filter: ItemFilter): [Item!]!
    search(term: String!): SearchResult!
    itemConnection(first: Int, after: String): ItemConnection!
  }

  input ItemFilter {
    name: String
    status: String
  }

  type Item {
    id: ID!
    name: String!
    tags: [String!]!
  }

  union SearchResult = Item | Label

  type Label {
    text: String!
  }

  type ItemConnection {
    nodes: [Item!]!
    pageInfo: PageInfo!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }
`);

const { typeMap: typeMapSource } = emitDslModules(minimalSchema, {
  typesImport: "../schema-types.js",
  customScalars: [],
});

export const minimalTypeMap = linkTypeMap(
  JSON.parse(typeMapSource.replace(/^export default /, "")),
);