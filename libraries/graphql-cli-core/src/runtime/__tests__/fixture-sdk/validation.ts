import { z, type ZodType } from "zod";
import {
  zodErrorToIssues,
  type GraphqlInputParseResult,
  type InputParserRegistry,
} from "@corpdk/graphql-input-zod";

/** Recursive filter: exercises `z.lazy` through `describe --json` (R-C06). */
type ItemFilterValue = {
  name?: string | undefined;
  and?: ItemFilterValue[] | undefined;
  or?: ItemFilterValue[] | undefined;
};

const itemFilter: ZodType<ItemFilterValue> = z.lazy(() =>
  z.object({
    name: z.string().optional(),
    and: z.array(itemFilter).optional(),
    or: z.array(itemFilter).optional(),
  }),
);

export const inputZodSchemas: InputParserRegistry = {
  ItemInput: z.object({
    name: z.string().min(1, "name must not be empty"),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  }),
  ItemFilter: itemFilter,
};

export const scalarZodSchemas: InputParserRegistry = {
  DateTime: z.iso.datetime({ message: "Invalid ISO 8601 date-time" }),
};

function parseWith(
  registry: InputParserRegistry,
  name: string,
  value: unknown,
): GraphqlInputParseResult<unknown> {
  const schema = registry[name];
  if (!schema) {
    return {
      ok: false,
      issues: [{ path: [], message: `Unknown schema ${name}`, code: "custom" }],
    };
  }
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, issues: zodErrorToIssues(result.error) };
}

export function safeParseGraphqlInput(name: string, value: unknown) {
  return parseWith(inputZodSchemas, name, value);
}

export function safeParseOptionalGraphqlInput(name: string, value: unknown) {
  return value === undefined || value === null
    ? ({ ok: true, data: value } as const)
    : safeParseGraphqlInput(name, value);
}

export function safeParseGraphqlInputList(name: string, value: unknown) {
  return parseWith({ [name]: z.array(inputZodSchemas[name]!) }, name, value);
}

export function safeParseOptionalGraphqlInputList(
  name: string,
  value: unknown,
) {
  return value === undefined || value === null
    ? ({ ok: true, data: value } as const)
    : safeParseGraphqlInputList(name, value);
}

export function safeParseGraphqlScalar(name: string, value: unknown) {
  return parseWith(scalarZodSchemas, name, value);
}
