"use client";

import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";
import type { ReactNode } from "react";

const httpLink = new HttpLink({ uri: "/api/graphql" });

const wsLink = new GraphQLWsLink(
  createClient({ url: process.env.NEXT_PUBLIC_DS_WS_URL! }),
);

/**
 * Split link: subscriptions go over WebSocket, queries/mutations over HTTP.
 * The same TypedDocumentNode operations from @corpdk/ds-sdk work with both.
 */
const splitLink = ApolloLink.split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return (
      def.kind === "OperationDefinition" && def.operation === "subscription"
    );
  },
  wsLink,
  httpLink,
);

const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}
