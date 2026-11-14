import { z, type output } from "zod";
import {
  GraphqlInputValidationError,
  type GraphqlInputParseResult,
  type InputParserRegistry,
  zodErrorToIssues,
} from "./errors.js";

function safeParseRegistryEntry<
  R extends InputParserRegistry,
  N extends keyof R,
>(registry: R, name: N, value: unknown): GraphqlInputParseResult<output<R[N]>> {
  const result = registry[name].safeParse(value);
  if (result.success) {
    return { ok: true, data: result.data as output<R[N]> };
  }
  return { ok: false, issues: zodErrorToIssues(result.error) };
}

export function createInputParsers<R extends InputParserRegistry>(registry: R) {
  function safeParseGraphqlInput<N extends keyof R>(
    name: N,
    value: unknown,
  ): GraphqlInputParseResult<output<R[N]>> {
    return safeParseRegistryEntry(registry, name, value);
  }

  function safeParseOptionalGraphqlInput<N extends keyof R>(
    name: N,
    value: unknown,
  ): GraphqlInputParseResult<output<R[N]> | undefined> {
    if (value === undefined || value === null) {
      return { ok: true, data: undefined };
    }
    return safeParseGraphqlInput(name, value);
  }

  function safeParseGraphqlInputList<N extends keyof R>(
    name: N,
    value: unknown,
  ): GraphqlInputParseResult<output<R[N]>[]> {
    const result = z.array(registry[name]).safeParse(value);
    if (result.success) {
      return { ok: true, data: result.data as output<R[N]>[] };
    }
    return { ok: false, issues: zodErrorToIssues(result.error) };
  }

  function safeParseOptionalGraphqlInputList<N extends keyof R>(
    name: N,
    value: unknown,
  ): GraphqlInputParseResult<output<R[N]>[] | undefined> {
    if (value === undefined || value === null) {
      return { ok: true, data: undefined };
    }
    return safeParseGraphqlInputList(name, value);
  }

  function parseGraphqlInput<N extends keyof R>(
    name: N,
    value: unknown,
  ): output<R[N]> {
    const result = safeParseGraphqlInput(name, value);
    if (result.ok) return result.data;
    throw new GraphqlInputValidationError(result.issues);
  }

  function parseOptionalGraphqlInput<N extends keyof R>(
    name: N,
    value: unknown,
  ): output<R[N]> | undefined {
    if (value === undefined || value === null) return undefined;
    return parseGraphqlInput(name, value);
  }

  return {
    safeParseGraphqlInput,
    safeParseOptionalGraphqlInput,
    safeParseGraphqlInputList,
    safeParseOptionalGraphqlInputList,
    parseGraphqlInput,
    parseOptionalGraphqlInput,
  };
}

export function createScalarParsers<R extends InputParserRegistry>(
  registry: R,
) {
  function safeParseGraphqlScalar<N extends keyof R>(
    name: N,
    value: unknown,
  ): GraphqlInputParseResult<output<R[N]>> {
    return safeParseRegistryEntry(registry, name, value);
  }

  function parseGraphqlScalar<N extends keyof R>(
    name: N,
    value: unknown,
  ): output<R[N]> {
    const result = safeParseGraphqlScalar(name, value);
    if (result.ok) return result.data;
    throw new GraphqlInputValidationError(result.issues);
  }

  return { safeParseGraphqlScalar, parseGraphqlScalar };
}
