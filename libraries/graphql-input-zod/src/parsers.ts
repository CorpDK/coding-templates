import { z, type ZodType } from "zod";
import {
  GraphqlInputValidationError,
  type GraphqlInputIssue,
  type GraphqlInputParseResult,
  zodErrorToIssues,
} from "./errors.js";

function parseResult<T>(result: {
  success: boolean;
  data?: T;
  error?: z.ZodError;
}): GraphqlInputParseResult<T> {
  if (result.success) {
    return { ok: true, data: result.data as T };
  }
  return { ok: false, issues: zodErrorToIssues(result.error!) };
}

function throwOnIssues(issues: GraphqlInputIssue[]): never {
  throw new GraphqlInputValidationError(issues);
}

export function createInputParsers<R extends Record<string, ZodType>>(
  registry: R,
) {
  return {
    safeParseGraphqlInput<N extends keyof R>(
      name: N,
      value: unknown,
    ): GraphqlInputParseResult<z.output<R[N]>> {
      return parseResult(registry[name].safeParse(value));
    },

    safeParseOptionalGraphqlInput<N extends keyof R>(
      name: N,
      value: unknown,
    ): GraphqlInputParseResult<z.output<R[N]> | undefined> {
      if (value === undefined || value === null) {
        return { ok: true, data: undefined };
      }
      return parseResult(registry[name].safeParse(value));
    },

    safeParseGraphqlInputList<N extends keyof R>(
      name: N,
      value: unknown,
    ): GraphqlInputParseResult<z.output<R[N]>[]> {
      return parseResult(z.array(registry[name]).safeParse(value));
    },

    safeParseOptionalGraphqlInputList<N extends keyof R>(
      name: N,
      value: unknown,
    ): GraphqlInputParseResult<z.output<R[N]>[] | undefined> {
      if (value === undefined || value === null) {
        return { ok: true, data: undefined };
      }
      return parseResult(z.array(registry[name]).safeParse(value));
    },

    parseGraphqlInput<N extends keyof R>(
      name: N,
      value: unknown,
    ): z.output<R[N]> {
      const result = registry[name].safeParse(value);
      if (result.success) {
        return result.data;
      }
      throwOnIssues(zodErrorToIssues(result.error));
    },

    parseOptionalGraphqlInput<N extends keyof R>(
      name: N,
      value: unknown,
    ): z.output<R[N]> | undefined {
      if (value === undefined || value === null) {
        return undefined;
      }
      const result = registry[name].safeParse(value);
      if (result.success) {
        return result.data;
      }
      throwOnIssues(zodErrorToIssues(result.error));
    },
  };
}

export function createScalarParsers<R extends Record<string, ZodType>>(
  registry: R,
) {
  return {
    safeParseGraphqlScalar<N extends keyof R>(
      name: N,
      value: unknown,
    ): GraphqlInputParseResult<z.output<R[N]>> {
      return parseResult(registry[name].safeParse(value));
    },

    parseGraphqlScalar<N extends keyof R>(
      name: N,
      value: unknown,
    ): z.output<R[N]> {
      const result = registry[name].safeParse(value);
      if (result.success) {
        return result.data;
      }
      throwOnIssues(zodErrorToIssues(result.error));
    },
  };
}
