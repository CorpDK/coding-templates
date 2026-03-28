# System Overview

---

## Component Topology

```
              ┌─────────────────────────────────────────────┐
              │              Browser / Client                 │
              │                                               │
              │  @corpdk/ui          @corpdk/ui-hprt          │
              │  Apollo Client       urql + Graphcache        │
              └──────┬───────────────────┬────────────────────┘
                     │ HTTP + WS         │ HTTP + WS
              ┌──────▼──────┐    ┌───────▼───────────┐
              │ @corpdk/ds  │    │ @corpdk/ds-hprt    │
              │ Yoga+Prisma │    │ Yoga+Drizzle       │
              └──────┬──────┘    └───────┬────────────┘
                     └─────────┬─────────┘
              ┌────────────────▼────────────────────────────┐
              │   PostgreSQL · MySQL · SQLite · CockroachDB  │
              └─────────────────────────────────────────────┘

  @corpdk/ds-cdb   — Yoga + Couchbase SDK   →  Couchbase Capella / self-hosted
  @corpdk/ds-mongo — Yoga + MongoDB driver  →  MongoDB Atlas / self-hosted
  @corpdk/ds-ddb   — Yoga + MongoDB driver  →  DocumentDB (documentdb.io)
  @corpdk/ds-file  — Yoga + fs/promises     →  JSON or YAML file on disk
```

The system has two independently deployable layers: a **Data Service (DS)** and a **UI**. Each layer is available in multiple variants that can be mixed based on storage and performance requirements. See [Data Service Design](03-data-service-design.md) for DS variant selection rationale.

---

## HTTP and WebSocket Routing

**HTTP traffic** (queries and mutations) flows through a Next.js rewrite:

```
Browser → /api/graphql → Next.js rewrite → DS_HTTP_URL (server-side)
```

**WebSocket traffic** (subscriptions) connects directly from the browser:

```
Browser → NEXT_PUBLIC_DS_WS_URL → DS WebSocket server
```

**Why the split?**
- HTTP proxying via Next.js rewrites keeps the DS origin hidden from the browser (no CORS configuration needed) and avoids exposing internal service URLs.
- Next.js cannot proxy WebSocket connections, so the DS WebSocket URL must be a public `NEXT_PUBLIC_` variable. This is acceptable because subscription endpoints don't expose sensitive server configuration.

---

## SDK Code Generation Pipeline

All DS packages share one GraphQL schema and generate a single shared TypeScript SDK:

```
DS package (src/schema/*.graphqls)
        │
        ▼
  graphql-codegen
        │
        ▼
@corpdk/ds-sdk  ← TypedDocumentNode types + hooks
        │
        ▼
  @corpdk/ui / @corpdk/ui-hprt
```

**Why a single shared SDK?**
All DS variants are schema-identical — they expose the same GraphQL API regardless of the underlying storage backend. Consolidating into one `@corpdk/ds-sdk` means UI packages have a single typed import regardless of which DS variant is deployed. It also means codegen only needs to run once per schema change.

The `dev` Turbo task declares `dependsOn: ["^build"]`, ensuring codegen and the SDK build complete before any UI dev server starts.

---

## Real-Time Subscriptions

Every mutation publishes a PubSub event. Clients subscribed via WebSocket receive updates automatically — no polling required.

The PubSub transport is selected at startup by `@corpdk/pub-sub`:

| `REDIS_URL` present | Transport | Use case |
|---------------------|-----------|----------|
| No | In-memory `EventTarget` | Development, single-process |
| Yes | Redis / Valkey | Production, multi-process / scaled |

**Why auto-selection?** Requiring code changes to switch transports creates environment-specific branches. The factory pattern (`createAppPubSub<T>()`) encapsulates the selection, so application code is identical in all environments. Only the env var changes.

See [PubSub Internals](../developer/04-pubsub-internals.md) for implementation details, and [PubSub / Redis](../admin/03-pubsub-redis.md) for deployment configuration.

---

## Turbo Task Pipeline

```
codegen → build → dev / start
```

| Task | Depends on | Cache |
|------|-----------|-------|
| `codegen` | — | Yes (cached per schema) |
| `build` | `^build` (upstream packages first) | Yes |
| `dev` | `^build` | No |
| `start` | `^build` | No |

`dev` depending on `^build` is the critical design choice: it ensures the shared packages (`packages/ui-*`) and `@corpdk/ds-sdk` are built before any consumer app's dev server starts. Without this, first-launch type errors occur when the SDK doesn't exist yet.

---

## Module System

Each package category has a different module system, driven by its runtime environment:

| Package type | `module` setting | Import extension | Reason |
|---|---|---|---|
| DS server (`ds`, `ds-hprt`, etc.) | `NodeNext` | Must use `.js` | Node.js ESM runtime; explicit extensions required |
| `ds-sdk` | `ESNext` / `bundler` | Must omit `.js` | Consumed by Next.js bundler, not Node.js directly |
| UI apps (`ui`, `ui-hprt`) | Next.js managed | N/A | Next.js controls compilation |
| Shared packages (`packages/ui-*`) | `ESNext` / `bundler` | Must omit `.js` | Consumed by Next.js bundler |

The DS packages use `"type": "module"` because GraphQL Yoga v5 is pure ESM. Next.js manages its own module system for UI packages, so they don't require `"type": "module"` at the package level.
