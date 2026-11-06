"use client";

import {
  createClient,
  fetchExchange,
  subscriptionExchange,
  Provider,
  type Operation,
} from "urql";
import { cacheExchange } from "@urql/exchange-graphcache";
import { createClient as createSseClient } from "graphql-sse";
import type { RequestParams } from "graphql-sse";
import type { ReactNode } from "react";

const operationsByRequest = new WeakMap<RequestParams, Operation>();

function headersRecord(
  input: HeadersInit | undefined,
): Record<string, string> {
  if (!input) {
    return {};
  }
  if (typeof Headers !== "undefined" && input instanceof Headers) {
    const out: Record<string, string> = {};
    input.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(input)) {
    return Object.fromEntries(input);
  }
  return { ...(input as Record<string, string>) };
}

function mergedHeadersFromOperation(op: Operation): Record<string, string> {
  const ctx = op.context;
  const fetchOpts =
    typeof ctx.fetchOptions === "function" ? ctx.fetchOptions() : ctx.fetchOptions;
  const fromFetch = headersRecord(fetchOpts?.headers);
  const ctxHeaders =
    (ctx as { headers?: Record<string, string> }).headers ?? {};
  return { ...ctxHeaders, ...fromFetch };
}

const sseClient = createSseClient({
  url: "/api/graphql",
  headers: async (request) => {
    if (!request) {
      return { Accept: "text/event-stream" };
    }
    const op = operationsByRequest.get(request);
    const merged = op ? mergedHeadersFromOperation(op) : {};
    return { ...merged, Accept: "text/event-stream" };
  },
});

const urqlClient = createClient({
  url: "/api/graphql",
  exchanges: [
    cacheExchange({
      // Graphcache config: add resolvers/updates/optimistic here as schema grows
    }),
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(request, operation) {
        const params: RequestParams = {
          query: request.query ?? "",
          variables: request.variables ?? undefined,
          operationName: request.operationName ?? undefined,
          extensions: request.extensions ?? undefined,
        };
        operationsByRequest.set(params, operation);
        return {
          subscribe: (sink) => {
            const dispose = sseClient.subscribe(params, sink);
            return {
              unsubscribe: () => {
                operationsByRequest.delete(params);
                dispose();
              },
            };
          },
        };
      },
    }),
  ],
});

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return <Provider value={urqlClient}>{children}</Provider>;
}
