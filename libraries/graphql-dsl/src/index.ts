export type { FieldsSelection } from "./runtime/typeSelection.js";
export {
  generateGraphqlOperation,
  getFieldFromPath,
  type GraphqlOperation,
  type Fields,
} from "./runtime/generateGraphqlOperation.js";
export { linkTypeMap } from "./runtime/linkTypeMap.js";
export type {
  BuiltOperation,
  ResultOf,
  VariablesOf,
  Everything,
} from "./runtime/builtOperation.js";
export { everything } from "./runtime/builtOperation.js";
export { v, isVariableRef, type VariableRef } from "./runtime/variableRef.js";
export type { ExactlyOneField } from "./runtime/aliasSelection.js";
export { createOperationApi } from "./runtime/createOperationApi.js";
export type {
  DefineOperationOptions,
  OperationApi,
} from "./runtime/createOperationApi.js";
export {
  normalizeGraphqlResult,
  unwrapGraphqlResult,
  toGraphqlRequestError,
  isGraphqlRequestError,
  type GraphqlRequestError,
  type GraphqlRequestErrorKind,
  type GraphqlErrorEntry,
} from "./runtime/normalizeGraphqlResult.js";
export {
  iterateConnection,
  paginateConnection,
  type ConnectionPage,
  type ConnectionExec,
  type IterateConnectionOptions,
} from "./runtime/iterateConnection.js";
export type {
  CompressedTypeMap,
  LinkedType,
  LinkedTypeMap,
} from "./runtime/types.js";
