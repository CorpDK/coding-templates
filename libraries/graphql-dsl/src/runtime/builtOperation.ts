import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { FieldsSelection } from "./typeSelection.js";
import type { GraphqlOperation } from "./generateGraphqlOperation.js";

export type BuiltOperation<
  Result,
  Vars extends Record<string, unknown> | undefined = undefined,
> = GraphqlOperation & {
  document: TypedDocumentNode<Result, Vars>;
};

export type ResultOf<Op> =
  Op extends BuiltOperation<infer R, infer _V> ? R : never;

export type VariablesOf<Op> =
  Op extends BuiltOperation<infer _R, infer V> ? V : never;

export type Everything = { __scalar: true };

export const everything: Everything = { __scalar: true };