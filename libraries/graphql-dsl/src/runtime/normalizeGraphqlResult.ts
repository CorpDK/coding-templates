export type GraphqlRequestErrorKind =
  | "validation"
  | "transport"
  | "graphql"
  | "userErrors";

export interface GraphqlErrorEntry {
  message: string;
  path?: readonly (string | number)[];
  code?: string;
  extensions?: Record<string, unknown>;
}

interface Base extends Error {
  operationName?: string;
  cause?: unknown;
}

export type GraphqlRequestError =
  | (Base & { kind: "validation"; issues: readonly unknown[] })
  | (Base & {
      kind: "transport";
      status?: number;
      timedOut: boolean;
      aborted: boolean;
    })
  | (Base & {
      kind: "graphql";
      errors: readonly GraphqlErrorEntry[];
      data?: unknown;
    })
  | (Base & {
      kind: "userErrors";
      field: string;
      userErrors: readonly unknown[];
      data: unknown;
    });

const ERROR_NAME = "GraphqlRequestError";

function makeError(
  kind: GraphqlRequestErrorKind,
  props: Record<string, unknown> & { message?: string },
): GraphqlRequestError {
  const err = new Error(String(props.message ?? kind)) as GraphqlRequestError;
  Object.assign(err, { kind, name: ERROR_NAME, ...props });
  return err;
}

function isValidationShape(value: unknown): value is {
  kind: "validation";
  issues: unknown[];
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "validation" &&
    Array.isArray((value as { issues?: unknown }).issues)
  );
}

function isAbortError(thrown: unknown): boolean {
  return (
    typeof thrown === "object" &&
    thrown !== null &&
    (thrown as { name?: string }).name === "AbortError"
  );
}

function firstGraphqlErrorMessage(errors: readonly unknown[]): string {
  const first = errors[0];
  if (first === undefined) return "GraphQL errors";
  if (typeof first === "object" && first !== null && "message" in first) {
    const msg = (first as { message: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  if (typeof first === "string") return first;
  try {
    return JSON.stringify(first);
  } catch {
    return "GraphQL error";
  }
}

function userErrorsFailure<R>(
  data: R,
  userFields: readonly string[],
  operationName?: string,
): { ok: false; error: GraphqlRequestError } | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;
  for (const opField of Object.keys(payload)) {
    if (opField.startsWith("__")) continue;
    const opPayload = payload[opField];
    if (!opPayload || typeof opPayload !== "object") continue;
    const root = opPayload as Record<string, unknown>;
    for (const field of userFields) {
      const value = root[field];
      if (Array.isArray(value) && value.length > 0) {
        return {
          ok: false,
          error: makeError("userErrors", {
            message: `Mutation returned ${field}`,
            field,
            userErrors: value,
            data,
            operationName,
          }),
        };
      }
    }
  }
  return null;
}

function parseGraphqlErrors(
  errors: readonly unknown[],
): readonly GraphqlErrorEntry[] {
  return errors.map((e) => {
    if (typeof e === "object" && e !== null && "message" in e) {
      const obj = e as {
        message: string;
        path?: (string | number)[];
        extensions?: Record<string, unknown>;
      };
      const code =
        obj.extensions && typeof obj.extensions.code === "string"
          ? obj.extensions.code
          : undefined;
      return {
        message: obj.message,
        path: obj.path,
        code,
        extensions: obj.extensions,
      };
    }
    return { message: String(e) };
  });
}

export function isGraphqlRequestError(
  value: unknown,
): value is GraphqlRequestError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Error).name === ERROR_NAME &&
    "kind" in value
  );
}

export function toGraphqlRequestError(
  thrown: unknown,
  options?: { operationName?: string },
): GraphqlRequestError {
  if (isGraphqlRequestError(thrown)) return thrown;
  if (isValidationShape(thrown)) {
    return makeError("validation", {
      message: "GraphQL input validation failed",
      issues: thrown.issues,
      operationName: options?.operationName,
    });
  }
  if (isAbortError(thrown)) {
    return makeError("transport", {
      message: "Request aborted",
      aborted: true,
      timedOut: false,
      operationName: options?.operationName,
      cause: thrown,
    });
  }
  if (thrown instanceof Error) {
    return makeError("transport", {
      message: thrown.message,
      aborted: false,
      timedOut: false,
      operationName: options?.operationName,
      cause: thrown,
    });
  }
  return makeError("transport", {
    message: "Unknown GraphQL transport failure",
    aborted: false,
    timedOut: false,
    operationName: options?.operationName,
    cause: thrown,
  });
}

export function normalizeGraphqlResult<R>(
  result: { data?: R | null; errors?: readonly unknown[] },
  options?: {
    operationName?: string;
    userErrorsFields?: readonly string[];
  },
): { ok: true; data: R } | { ok: false; error: GraphqlRequestError } {
  const userFields = options?.userErrorsFields ?? ["userErrors"];

  if (result.errors && result.errors.length > 0) {
    return {
      ok: false,
      error: makeError("graphql", {
        message: firstGraphqlErrorMessage(result.errors),
        errors: parseGraphqlErrors(result.errors),
        data: result.data,
        operationName: options?.operationName,
      }),
    };
  }

  if (result.data != null) {
    const userErr = userErrorsFailure(
      result.data,
      userFields,
      options?.operationName,
    );
    if (userErr) return userErr;
  }

  if (result.data == null) {
    return {
      ok: false,
      error: makeError("transport", {
        message: "Response contained no data",
        aborted: false,
        timedOut: false,
        operationName: options?.operationName,
      }),
    };
  }

  return { ok: true, data: result.data };
}

export function unwrapGraphqlResult<R>(
  result: { data?: R | null; errors?: readonly unknown[] },
  options?: { operationName?: string; userErrorsFields?: readonly string[] },
): R {
  const normalized = normalizeGraphqlResult(result, options);
  if (!normalized.ok) throw normalized.error;
  return normalized.data;
}
