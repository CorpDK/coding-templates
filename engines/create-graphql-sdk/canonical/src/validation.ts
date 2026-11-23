import {
  createInputParsers,
  createScalarParsers,
} from "@corpdk/graphql-input-zod";
import { inputZodSchemas } from "./generated/input-registry.js";
import { scalarZodSchemas } from "./generated/scalar-registry.js";

export * from "./generated/input-schemas.js";
export { inputZodSchemas, scalarZodSchemas };
export type { InputZodSchemaName } from "./generated/input-registry.js";
export type { ScalarZodSchemaName } from "./generated/scalar-registry.js";
export {
  GraphqlInputValidationError,
  type GraphqlInputIssue,
  type GraphqlInputParseResult,
} from "@corpdk/graphql-input-zod";

export const {
  safeParseGraphqlInput,
  safeParseOptionalGraphqlInput,
  safeParseGraphqlInputList,
  safeParseOptionalGraphqlInputList,
  parseGraphqlInput,
  parseOptionalGraphqlInput,
} = createInputParsers(inputZodSchemas);
export const { safeParseGraphqlScalar, parseGraphqlScalar } =
  createScalarParsers(scalarZodSchemas);