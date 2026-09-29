# `@corpdk/ds` subscription transport (SSE)

GraphQL Yoga v5 delivers subscriptions over **Server-Sent Events (SSE)** on the same HTTP route as queries and mutations. The primary DS template (`templates/ds`) no longer starts a WebSocket server or depends on `graphql-ws` / `ws`.

Other DS variants (`ds-no-sql`, `ds-cdb`, etc.) may still use WebSocket until they are migrated the same way.

---

## Server endpoint

| Use            | URL                         | Notes                                      |
| -------------- | --------------------------- | ------------------------------------------ |
| Queries        | `http://<host>:<port>/graphql` | `POST`, `Content-Type: application/json` |
| Mutations      | same                        | same                                       |
| Subscriptions  | same                        | Must include `Accept: text/event-stream`   |

Configure the listen port with `DS_PORT` (see `templates/ds/.env.example`). There is no separate subscription port or `DS_WS_*` variable for this template.

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

## UI migration (deferred)

Template UI packages (`templates/ui`, `templates/ui-hprt`) still use **graphql-ws** and `NEXT_PUBLIC_DS_WS_URL`. They are **out of scope** for the DS-only SSE migration.

When updating the UI:

1. Route subscriptions through the **same GraphQL HTTP URL** as queries (Next.js `rewrites()` can proxy SSE; no direct browser WebSocket to the DS is required).
2. Use a client that supports Yoga’s SSE subscription protocol (e.g. Apollo Client 3.10+ with appropriate link configuration, urql with an SSE exchange, or `fetch` + `EventSource`-compatible parsing).
3. Remove dependency on `NEXT_PUBLIC_DS_WS_URL` for projects scaffolded from `@corpdk/ds` only.

Until then, local full-stack dev with the stock UI templates against `@corpdk/ds` will not receive live subscription updates unless the UI is updated or you use GraphiQL/curl against the DS directly.

---

## Pub/sub and resolvers

Subscription resolvers and `@corpdk/pub-sub` usage are unchanged. Only the **wire transport** from Yoga to the client moved from WebSocket to SSE.

---

## Generated CLI (`ds-cli`)

The CLI preset still documents `DS_WS_URL` for subscription subcommands (WebSocket-based generator output). Point automation at the DS with `DS_HTTP_URL` for queries/mutations; subscription CLI streaming will be updated in a follow-up to use SSE.

---

**Related**: [Data Service Design](../architecture/03-data-service-design.md) | [Pub/Sub internals](04-pubsub-internals.md)
