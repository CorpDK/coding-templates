import type { ZodType } from "zod";
import { inputZodSchemas, type InputZodSchemaName } from "../generated/dal/input-zod.js";

/**
 * Parse and validate a GraphQL input object using DAL-generated Zod schemas.
 * Use in custom resolvers or middleware when runtime checks beyond GraphQL SDL are needed.
 */
export function parseGraphqlInput<TName extends InputZodSchemaName>(
  schemaName: TName,
  value: unknown,
): ReturnType<(typeof inputZodSchemas)[TName]["parse"]> {
  const schema = inputZodSchemas[schemaName] as ZodType;
  return schema.parse(value) as ReturnType<(typeof inputZodSchemas)[TName]["parse"]>;
}

export { inputZodSchemas, type InputZodSchemaName };
