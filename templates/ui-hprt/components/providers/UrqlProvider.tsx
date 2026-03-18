"use client";

import { createClient, fetchExchange, subscriptionExchange, Provider } from "urql";
import { cacheExchange } from "@urql/exchange-graphcache";
import { createClient as createWSClient } from "graphql-ws";
import type { SubscribePayload } from "graphql-ws";
import type { ReactNode } from "react";

const wsClient = createWSClient({ url: process.env.NEXT_PUBLIC_DS_WS_URL! });

const urqlClient = createClient({
  url: "/api/graphql",
  exchanges: [
    cacheExchange({
      // Graphcache config: add resolvers/updates/optimistic here as schema grows
    }),
    fetchExchange,
    subscriptionExchange({
      forwardSubscription: (operation) => ({
        subscribe: (sink) => ({
          // Cast: urql v5 FetchBody has query?: string; graphql-ws requires query: string
          unsubscribe: wsClient.subscribe(operation as SubscribePayload, sink),
        }),
      }),
    }),
  ],
});

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return <Provider value={urqlClient}>{children}</Provider>;
}
