import { buildSchema } from "graphql";

/** Schema behind the fixture SDK (a hand-sized stand-in for a DAL snapshot). */
export const fixtureSdl = /* GraphQL */ `
  scalar DateTime

  enum ItemStatus {
    ACTIVE
    ARCHIVED
  }

  input ItemInput {
    name: String!
    status: ItemStatus
  }

  input ItemFilter {
    name: String
    and: [ItemFilter!]
    or: [ItemFilter!]
  }

  type Item {
    id: ID!
    name: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type ItemEdge {
    cursor: String!
    node: Item!
  }

  type ItemConnection {
    nodes: [Item!]!
    edges: [ItemEdge!]!
    pageInfo: PageInfo!
  }

  type UserError {
    code: String!
    field: [String!]
    message: String!
  }

  type CreateItemPayload {
    item: Item
    userErrors: [UserError!]!
  }

  type DeleteItemPayload {
    deleted: Boolean!
    userErrors: [UserError!]!
  }

  type ItemEvent {
    id: ID!
    operation: String!
  }

  type Query {
    hello(name: String): String!
    item(id: ID!, includeDeleted: Boolean): Item
    items(
      ids: [ID!]
      status: ItemStatus
      limit: Int
      price: Float
      since: DateTime
      filter: ItemFilter
    ): [Item!]!
    itemConnection(
      first: Int
      after: String
      last: Int
      before: String
      filter: ItemFilter
    ): ItemConnection!
  }

  type Mutation {
    createItem(input: ItemInput!): CreateItemPayload!
    bulkCreateItem(inputs: [ItemInput!]!): [CreateItemPayload!]!
    deleteItem(id: ID!): DeleteItemPayload!
  }

  type Subscription {
    itemChanged(ids: [ID!]): ItemEvent!
  }
`;

export const fixtureSchema = buildSchema(fixtureSdl);
