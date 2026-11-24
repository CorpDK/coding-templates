import {
  toGraphqlRequestError,
  type GraphqlRequestError,
} from "@corpdk/graphql-dsl";
import type { RuntimeConfig } from "../codegen/types.js";
import { createRedactor, resolveHeaders, type HeaderMap } from "./headers.js";
import type { CliExtensions } from "./types.js";

/** Everything a request needs; headers are re-resolved for every request. */
export interface Transport {
  endpoint: string;
  fetchImpl: typeof fetch;
  /** Per-request HTTP timeout in milliseconds. */
  timeoutMs: number;
  headers(): Promise<HeaderMap>;
  /** Scrubs known secrets from text that may reach stdout or stderr. */
  redact(text: string): string;
}

export interface TransportInit {
  config: RuntimeConfig;
  env: NodeJS.ProcessEnv;
  endpoint: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  extensions?: CliExtensions;
}

export function createTransport(init: TransportInit): Transport {
  const redactor = createRedactor(init.endpoint);
  return {
    endpoint: init.endpoint,
    fetchImpl: init.fetchImpl,
    timeoutMs: init.timeoutMs,
    async headers() {
      const headers = await resolveHeaders(
        init.config,
        init.env,
        init.endpoint,
        init.extensions,
      );
      redactor.learn(headers);
      return headers;
    },
    redact: redactor.redact,
  };
}

/** Builds a `transport`-kind error through the SDK normaliser. */
export function transportFailure(
  message: string,
  extra: { status?: number; timedOut?: boolean } = {},
): GraphqlRequestError {
  return Object.assign(toGraphqlRequestError(new Error(message)), extra);
}

/** Wraps a thrown fetch/read error, distinguishing timeout and abort. */
export function wrapFetchError(
  thrown: unknown,
  timeoutMs: number,
  timedOut: boolean,
): GraphqlRequestError {
  if (timedOut) {
    return transportFailure(`Request timed out after ${timeoutMs} ms`, {
      timedOut: true,
    });
  }
  return toGraphqlRequestError(thrown);
}
