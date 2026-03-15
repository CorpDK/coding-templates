# coding-templates

A pnpm + Turborepo monorepo template for full-stack GraphQL applications under the `@corpdk` org.

## Packages

| Package | Description |
|---------|-------------|
| `@corpdk/ui` | Next.js + Apollo Client (standard UI) |
| `@corpdk/ui-hprt` | Next.js + urql + Graphcache (high-performance real-time UI) |
| `@corpdk/ds` | GraphQL Yoga + Prisma + PostgreSQL (standard data service) |
| `@corpdk/ds-hprt` | GraphQL Yoga + Drizzle + PostgreSQL (high-performance real-time data service) |
| `@corpdk/ds-cdb` | GraphQL Yoga + Couchbase SDK + Zod (cloud-agnostic NoSQL data service) |
| `@corpdk/ds-sdk` | Auto-generated TypedDocumentNode SDK from `ds` schema |
| `@corpdk/ds-sdk-hprt` | Auto-generated TypedDocumentNode SDK from `ds-hprt` schema |
| `@corpdk/ds-sdk-cdb` | Auto-generated TypedDocumentNode SDK from `ds-cdb` schema |

## Getting Started

```bash
pnpm install
```

Copy `.env.example` to `.env` in each package you intend to run and fill in the values.

```bash
pnpm dev          # Start all packages
pnpm build        # Build all packages (runs codegen first)
pnpm codegen      # Regenerate TypedDocumentNode SDKs
```

## Architecture

```
              ┌─────────────────────────────────────────────┐
              │              Browser / Client                 │
              │                                               │
              │  @corpdk/ui          @corpdk/ui-hprt          │
              │  Apollo Client       urql + Graphcache        │
              └──────┬───────────────────┬────────────────────┘
                     │ HTTP + WS         │ HTTP + WS
              ┌──────▼──────┐    ┌───────▼──────────┐    ┌─────────────────┐
              │ @corpdk/ds  │    │ @corpdk/ds-hprt   │    │ @corpdk/ds-cdb  │
              │ Yoga+Prisma │    │ Yoga+Drizzle      │    │ Yoga+Couchbase  │
              └──────┬──────┘    └───────┬───────────┘    └────────┬────────┘
                     │                   │                          │
              ┌──────▼───────────────────▼───────┐    ┌────────────▼────────┐
              │            PostgreSQL              │    │      Couchbase       │
              └────────────────────────────────────┘    └─────────────────────┘
```

**HTTP traffic** is proxied through Next.js rewrites (`/api/graphql → DS_HTTP_URL`).
**WebSocket subscriptions** connect directly via `NEXT_PUBLIC_DS_WS_URL`.

## Real-Time Subscriptions

Every mutation publishes a PubSub event. Clients subscribed via WebSocket receive updates automatically — no polling required.

The PubSub layer defaults to in-memory (`EventTarget`). Swap to Redis/Valkey in one line:

```typescript
// packages/ds/src/pubsub/index.ts
// const eventTarget = createMemoryEventTarget();
const eventTarget = createRedisEventTarget(); // uncomment to switch
```

## SDK Code Generation

The DS packages generate TypeScript SDKs (`TypedDocumentNode`) consumed by the UI packages.

```bash
pnpm --filter @corpdk/ds codegen       # regenerate ds-sdk
pnpm --filter @corpdk/ds-hprt codegen  # regenerate ds-sdk-hprt
pnpm --filter @corpdk/ds-cdb codegen   # regenerate ds-sdk-cdb
```

Turbo runs codegen automatically before every build.

## Environment Variables

Each package reads from its own `.env`. See `.env.example` in each package for required variables.

| Package | Key Variables |
|---------|--------------|
| `ds` | `DS_PORT`, `DATABASE_URL` |
| `ds-hprt` | `DS_HPRT_PORT`, `DS_HPRT_DATABASE_URL` |
| `ds-cdb` | `DS_CDB_PORT`, `DS_CDB_CONNECTION_STRING`, `DS_CDB_USERNAME`, `DS_CDB_PASSWORD`, `DS_CDB_BUCKET` |
| `ui` | `DS_HTTP_URL`, `NEXT_PUBLIC_DS_WS_URL` |
| `ui-hprt` | `DS_HTTP_URL`, `NEXT_PUBLIC_DS_WS_URL` |

No port defaults — all values must be explicitly configured.
