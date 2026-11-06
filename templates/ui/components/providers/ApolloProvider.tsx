"use client";

import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  Observable,
} from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { getMainDefinition } from "@apollo/client/utilities";
import { headersRecord } from "@corpdk/ui-core";
import { print } from "graphql";
import { createClient } from "graphql-sse";
import type { RequestParams } from "graphql-sse";
import type { ReactNode } from "react";

const httpLink = new HttpLink({ uri: "/api/graphql" });

function withoutAcceptHeader(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "accept") {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Subscriptions over HTTP SSE (`Accept: text/event-stream`) via the same Next.js
 * `/api/graphql` proxy as queries and mutations. Matches GraphQL Yoga on DS templates.
 */
class SseSubscriptionLink extends ApolloLink {
  public override request(
    operation: ApolloLink.Operation,
  ): Observable<ApolloLink.Result> {
    const request: RequestParams = {
      operationName: operation.operationName ?? undefined,
      query: print(operation.query),
      variables: operation.variables ?? undefined,
      extensions: operation.extensions ?? undefined,
    };
    const sseClient = createClient({
      url: "/api/graphql",
      headers: () => {
        const ctxHeaders = withoutAcceptHeader(
          headersRecord(
            operation.getContext().headers as HeadersInit | undefined,
          ),
        );
        return { ...ctxHeaders, Accept: "text/event-stream" };
      },
    });
    return new Observable((sink) => {
      const dispose = sseClient.subscribe(request, {
        next: sink.next.bind(sink),
        complete: sink.complete.bind(sink),
        error: sink.error.bind(sink),
      });
      return () => {
        dispose();
        sseClient.dispose();
      };
    });
  }
}

const sseLink = new SseSubscriptionLink();

const splitLink = ApolloLink.split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return (
      def.kind === "OperationDefinition" && def.operation === "subscription"
    );
  },
  sseLink,
  httpLink,
);

const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}
