"use client";

import {
  createClient,
  fetchExchange,
  subscriptionExchange,
  Provider,
} from "urql";
import { cacheExchange } from "@urql/exchange-graphcache";
import { createClient as createSseClient } from "graphql-sse";
import type { ReactNode } from "react";

const sseClient = createSseClient({
  url: "/api/graphql",
  headers: () => ({ Accept: "text/event-stream" }),
});

const urqlClient = createClient({
  url: "/api/graphql",
  exchanges: [
    cacheExchange({
      // Graphcache config: add resolvers/updates/optimistic here as schema grows
    }),
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(request) {
        return {
          subscribe: (sink) => {
            const dispose = sseClient.subscribe(
              {
                query: request.query!,
                variables: request.variables ?? undefined,
                operationName: request.operationName ?? undefined,
                extensions: request.extensions ?? undefined,
              },
              sink,
            );
            return { unsubscribe: dispose };
          },
        };
      },
    }),
  ],
});

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return <Provider value={urqlClient}>{children}</Provider>;
}
