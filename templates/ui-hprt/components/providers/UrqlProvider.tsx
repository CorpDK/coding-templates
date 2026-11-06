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

const operationsBySubscriptionKey = new Map<string, Operation>();

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

function subscriptionKeyFromParams(params: {
  operationName?: string | null;
  query?: string | null;
  variables?: unknown;
  extensions?: unknown;
}): string {
  const name = params.operationName ?? "";
  const query = params.query ?? "";
  return `${name}\0${query}\0${stableStringify(params.variables)}\0${stableStringify(params.extensions)}`;
}

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

async function mergedHeadersFromOperation(
  op: Operation,
): Promise<Record<string, string>> {
  const ctx = op.context;
  const rawFetchOpts =
    typeof ctx.fetchOptions === "function" ? ctx.fetchOptions() : ctx.fetchOptions;
  const fetchOpts = await Promise.resolve(rawFetchOpts);
  const fromFetch = headersRecord(fetchOpts?.headers);
  const ctxHeaders = headersRecord(
    (ctx as { headers?: HeadersInit }).headers,
  );
  return { ...ctxHeaders, ...fromFetch };
}

const sseClient = createSseClient({
  url: "/api/graphql",
  headers: async (request) => {
    if (!request) {
      return { Accept: "text/event-stream" };
    }
    const op = operationsBySubscriptionKey.get(subscriptionKeyFromParams(request));
    const merged = op ? await mergedHeadersFromOperation(op) : {};
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
        const key = subscriptionKeyFromParams(params);
        operationsBySubscriptionKey.set(key, operation);
        return {
          subscribe: (sink) => {
            const dispose = sseClient.subscribe(params, sink);
            return {
              unsubscribe: () => {
                operationsBySubscriptionKey.delete(key);
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
