import type { GraphqlOperation } from "@corpdk/graphql-dsl";
import {
  transportFailure,
  wrapFetchError,
  type Transport,
} from "./transport.js";

/** JSON body of a GraphQL-over-HTTP response. */
export interface GraphqlResponse {
  data?: unknown;
  errors?: readonly unknown[];
  extensions?: unknown;
}

const BODY_SNIPPET_LENGTH = 200;

export function requestBody(operation: GraphqlOperation): string {
  return JSON.stringify({
    query: operation.query,
    variables: operation.variables ?? {},
    ...(operation.operationName
      ? { operationName: operation.operationName }
      : {}),
  });
}

function snippet(text: string): string {
  const flat = text.replaceAll(/\s+/g, " ").trim();
  return flat.length > BODY_SNIPPET_LENGTH
    ? `${flat.slice(0, BODY_SNIPPET_LENGTH)}…`
    : flat;
}

function parseResponseBody(text: string, status: number): GraphqlResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw transportFailure(
      `Response is not valid JSON (HTTP ${status}): ${snippet(text)}`,
      { status },
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw transportFailure(`Response is not a JSON object (HTTP ${status})`, {
      status,
    });
  }
  return parsed as GraphqlResponse;
}

/**
 * Sends one GraphQL operation with a single HTTP POST (no retries, doc 14
 * §4.9). Throws a `transport`-kind `GraphqlRequestError` for network failure,
 * timeout, abort, non-2xx status or a non-JSON body.
 */
export async function postOperation(
  transport: Transport,
  operation: GraphqlOperation,
  signal?: AbortSignal,
): Promise<GraphqlResponse> {
  const headers = await transport.headers();
  const timeout = AbortSignal.timeout(transport.timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let status: number;
  let statusText: string;
  let text: string;
  try {
    const response = await transport.fetchImpl(transport.endpoint, {
      method: "POST",
      headers,
      body: requestBody(operation),
      signal: combined,
    });
    status = response.status;
    statusText = response.statusText;
    text = await response.text();
  } catch (thrown) {
    throw wrapFetchError(thrown, transport.timeoutMs, timeout.aborted);
  }

  if (status < 200 || status >= 300) {
    throw transportFailure(
      `HTTP ${status} ${statusText}`.trim() + (text ? `: ${snippet(text)}` : ""),
      { status },
    );
  }
  return parseResponseBody(text, status);
}
