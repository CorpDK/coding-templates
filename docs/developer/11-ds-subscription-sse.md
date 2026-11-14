# DS subscription transport (SSE, all templates)

GraphQL Yoga v5 delivers subscriptions over **Server-Sent Events (SSE)** on the same HTTP route as queries and mutations. All DS templates (`templates/ds`, `ds-no-sql`, `ds-cdb`, `ds-mongo`, `ds-ddb`, `ds-file`) use Yoga’s built-in SSE transport and do not start a WebSocket server or depend on `graphql-ws` / `ws` at runtime.

The root `pnpm.overrides` map `graphql-ws` and `ws` to workspace stubs (`libraries/graphql-ws-stub`, `libraries/ws-stub`) so GraphQL Codegen and `@graphql-tools/*` can load optional WebSocket modules without installing real socket stacks. DS Dockerfiles copy both stubs into the `deps` stage before `pnpm install`.

---

## Server endpoint

| Use           | URL                            | Notes                                    |
| ------------- | ------------------------------ | ---------------------------------------- |
| Queries       | `http://<host>:<port>/graphql` | `POST`, `Content-Type: application/json` |
| Mutations     | same                           | same                                     |
| Subscriptions | same                           | Must include `Accept: text/event-stream` |

Configure the listen port with the variant’s `*_PORT` env var (see each template’s `.env.example`). There is no separate subscription port or DS WebSocket listener.

---

## Client connection pattern

Yoga streams subscription results as SSE `event: next` frames with JSON `data:` payloads (GraphQL response shape).

### POST (recommended for clients with variables)

```http
POST /graphql HTTP/1.1
Host: localhost:4000
Content-Type: application/json
Accept: text/event-stream

{
  "query": "subscription { itemCreated { id name } }",
  "variables": {}
}
```

Pass auth the same way you will for HTTP queries (e.g. `Authorization: Bearer …` or a custom header once an auth plugin is wired). Yoga runs the same Envelop context pipeline as other operations.

### GET (GraphiQL-style / quick checks)

```bash
curl -N -H "Accept: text/event-stream" \
  "http://localhost:4000/graphql?query=subscription%20%7B%20countdown(from%3A%203)%20%7D"
```

---

## UI templates (`templates/ui`, `templates/ui-hprt`)

Stock UI apps route **queries, mutations, and subscriptions** through the same Next.js `/api/graphql` rewrite as other GraphQL operations. Subscription operations send `Accept: text/event-stream` and stream results over **SSE** (`graphql-sse` with Apollo Client or urql’s `subscriptionExchange`). No browser WebSocket and no `NEXT_PUBLIC_DS_WS_URL` are required.

---

## Pub/sub and resolvers

Subscription resolvers and `@corpdk/pub-sub` usage are unchanged. Only the **wire transport** from Yoga to the client moved from WebSocket to SSE.

---

## Generated CLI (`ds-cli`)

Subscription subcommands use the same `DS_HTTP_URL` as queries and mutations: they issue an HTTP `POST` with `Accept: text/event-stream` and print each GraphQL execution result as a line of JSON (NDJSON), matching GraphQL Yoga’s SSE framing (`event: next` / `data:`).

---

**Related**: [Data Service Design](../architecture/03-data-service-design.md) | [Pub/Sub internals](04-pubsub-internals.md)
