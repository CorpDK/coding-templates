export * from "./generated/dsl/index.js";
export type * as Selections from "./generated/dsl/selections.js";
export {
  normalizeGraphqlResult,
  unwrapGraphqlResult,
  toGraphqlRequestError,
  isGraphqlRequestError,
  type GraphqlRequestError,
  type GraphqlRequestErrorKind,
  type GraphqlErrorEntry,
} from "@corpdk/graphql-dsl";
export type {
  BuiltOperation,
  ResultOf,
  VariablesOf,
} from "@corpdk/graphql-dsl";
export type { TypedDocumentNode } from "@graphql-typed-document-node/core";
export type * as Types from "./generated/schema-types.js";
export * from "./extensions/index.js";