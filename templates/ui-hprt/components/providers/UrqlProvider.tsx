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
        const sseClient = createSseClient({
          url: "/api/graphql",
          headers: async () => {
            const merged = await mergedHeadersFromOperation(operation);
            return { ...merged, Accept: "text/event-stream" };
          },
        });
        return {
          subscribe: (sink) => {
            const dispose = sseClient.subscribe(params, sink);
            return {
              unsubscribe: () => {
                dispose();
                sseClient.dispose();
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
