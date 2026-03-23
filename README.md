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
| `@corpdk/ds-mongo` | GraphQL Yoga + MongoDB native driver + Zod (NoSQL data service) |
| `@corpdk/ds-ddb` | GraphQL Yoga + DocumentDB (documentdb.io) + Zod (NoSQL data service) |
| `@corpdk/ds-file` | GraphQL Yoga + JSON/YAML file storage + Zod (zero-dependency data service) |
| `@corpdk/ds-sdk` | Auto-generated TypedDocumentNode SDK (shared by all DS variants) |
| `@corpdk/pub-sub` | Plugin-style pub/sub factory — `createAppPubSub<T>()` wires memory or Redis; topics defined per app |

## Scaffolding a New Project

`pnpm create-app` scaffolds a new full-stack GraphQL project from the templates in this repo. It supports two modes: an **interactive** guided prompt flow for local setup, and a **non-interactive** flag-driven mode suitable for CI and scripting.

```bash
pnpm create-app          # interactive
pnpm create-app --help   # show all flags
```

### Interactive Mode

Run `pnpm create-app` with no flags. You will be guided through these steps:

1. **Project name** — lowercase letters, numbers, and hyphens; must start with a letter (e.g. `my-app`)
2. **Org scope** — your npm organisation scope without `@` (e.g. `myorg`)
3. **What are you scaffolding?** — choose the project shape:
   - `Full-stack` — UI + DS (GraphQL Yoga + chosen storage)
   - `DS only` — GraphQL Yoga backend only
   - `UI only` — Next.js frontend that connects to an external DS
4. **Output directory** — where to write the project (default: `./<name>`)
5. **Storage type** _(Full-stack / DS only)_ — top-level backend category:
   - `relational` — SQL databases via Prisma or Drizzle ORM
   - `document` — NoSQL: Couchbase, MongoDB, or DocumentDB
   - `filebased` — JSON/YAML file storage, zero external dependencies
6. **ORM** _(relational only)_ — `prisma` (all 4 SQL DBs) or `drizzle` (all 4 SQL DBs, high-performance real-time)
7. **Document DB provider** _(document only)_ — `couchbase`, `mongodb`, or `documentdb`
8. **Implementation** _(MongoDB/DocumentDB only)_ — `standard` (Prisma ORM) or `hprt` (native SDK, no ORM overhead)
9. **Database** _(relational only)_ — `postgresql` (default), `mysql`, `sqlite`, or `cockroachdb`
10. **UI variant** _(Full-stack / UI only)_ — `standard` (Apollo Client) or `hprt` (urql + Graphcache); filtered by DS choice in Full-stack mode
11. **External SDK** _(UI only)_ — must be a published scoped package (e.g. `@acme/ds-sdk`)
12. **Generate `.env` files** — copy `.env.example` → `.env` in each package (default: yes)
13. **Init git repository** — run `git init` and create an initial commit (default: yes)

### Non-Interactive Mode

Pass `--name` (or `-n`) to enter non-interactive mode. The scaffold type is inferred from the flags you provide:

| Scaffold type | Flags |
|---------------|-------|
| **Full-stack** | `--storage-type` + `--ui` |
| **DS only** | `--storage-type` (no `--ui`) |
| **UI only** | `--ui` + `--sdk` (no `--storage-type`) |

All available flags:

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--name` | `-n` | required | Project name |
| `--scope` | `-s` | required | Org scope without `@` |
| `--output` | `-o` | `./<name>` | Output directory |
| `--storage-type` | — | _(none)_ | `relational \| document \| filebased` |
| `--orm` | — | `prisma` | `prisma \| drizzle` _(relational only)_ |
| `--db` | — | `postgresql` | `postgresql \| mysql \| sqlite \| cockroachdb` _(relational only)_ |
| `--document-provider` | — | `couchbase` | `couchbase \| mongodb \| documentdb` _(document only)_ |
| `--document-impl` | — | `standard` | `standard \| hprt` _(mongodb/documentdb only)_ |
| `--ui` | — | _(none)_ | `standard \| hprt` |
| `--sdk` | — | — | External SDK package (required for UI only mode) |
| `--no-env` | — | — | Skip `.env` generation |
| `--no-git` | — | — | Skip git init |
| `--yes` | `-y` | — | Accept all defaults (still requires `--name` and `--scope`) |
| `--help` | `-h` | — | Show usage |

### Storage / UI Compatibility

| Storage | DS package | Compatible UI |
|---------|------------|---------------|
| `relational` + `prisma` | `ds` | `standard` only |
| `relational` + `drizzle` | `ds-hprt` | `hprt` only |
| `document` + Couchbase | `ds-cdb` | `standard` or `hprt` |
| `document` + MongoDB + `hprt` | `ds-mongo` | `standard` or `hprt` |
| `document` + DocumentDB + `hprt` | `ds-ddb` | `standard` or `hprt` |
| `document` + MongoDB/DocumentDB + `standard` | `ds` (Prisma) | `standard` only |
| `filebased` | `ds-file` | `standard` or `hprt` |
| _(none)_ | — | `standard` or `hprt` + `--sdk` |

### Examples

```bash
# Full-stack — Relational, Drizzle, PostgreSQL, HPRT UI
pnpm create-app --name my-app --scope myorg --storage-type relational --orm drizzle --db postgresql --ui hprt

# Full-stack — Relational, Prisma, MySQL, standard UI
pnpm create-app --name my-app --scope myorg --storage-type relational --orm prisma --db mysql --ui standard

# Full-stack — Document DB, MongoDB, native SDK, standard UI
pnpm create-app --name my-app --scope myorg --storage-type document --document-provider mongodb --document-impl hprt --ui standard

# Full-stack — File-based DB, HPRT UI
pnpm create-app --name my-app --scope myorg --storage-type filebased --ui hprt

# DS only — Drizzle + SQLite
pnpm create-app --name my-api --scope myorg --storage-type relational --orm drizzle --db sqlite

# DS only — Couchbase
pnpm create-app --name my-api --scope myorg --storage-type document --document-provider couchbase

# UI only — standalone Next.js with external published SDK
pnpm create-app --name my-ui --scope myorg --ui standard --sdk @acme/ds-sdk
```

### After Scaffolding

```bash
cd <outputDir>
pnpm install
# Edit .env files in each package with your credentials
pnpm codegen   # monorepo only — generate TypedDocumentNode SDK types
pnpm dev       # start all selected packages
```

### Docker

Every scaffolded project includes production-ready Dockerfiles co-located with each package:

| Scaffold type | Dockerfile location | Build command |
|---------------|--------------------|----|
| DS (monorepo) | `packages/<ds>/Dockerfile` | `docker build -f packages/ds/Dockerfile -t my-app-ds .` |
| UI (monorepo) | `packages/<ui>/Dockerfile` | `docker build -f packages/ui/Dockerfile -t my-app-ui .` |
| UI only (standalone) | `Dockerfile` | `docker build -t my-app .` |

All monorepo Dockerfiles use the **repo root as build context** (needed for `pnpm-lock.yaml` and workspace manifests).

The UI Dockerfile uses Next.js [standalone output](https://nextjs.org/docs/app/api-reference/next-config-js/output). Add `output: 'standalone'` to the UI package's `next.config.ts` before building:

```typescript
// packages/ui/next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
  // ...
};
```

---

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

**HTTP traffic** is proxied through Next.js rewrites (`/api/graphql → DS_HTTP_URL`).
**WebSocket subscriptions** connect directly via `NEXT_PUBLIC_DS_WS_URL`.

All DS packages share the same GraphQL schema (defined as multiple `.graphqls` files in `src/schema/`) and generate their SDK into `@corpdk/ds-sdk`.

## Real-Time Subscriptions

Every mutation publishes a PubSub event. Clients subscribed via WebSocket receive updates automatically — no polling required.

The PubSub layer auto-selects based on `REDIS_URL`: Redis/Valkey when the variable is set, in-memory (`EventTarget`) otherwise. The wiring is handled by `@corpdk/pub-sub`; each DS package defines only its own topics:

```typescript
// src/pubsub/index.ts (all DS packages)
import { createAppPubSub } from "@corpdk/pub-sub";

export type PubSubTopics = {
  PING_SENT: [{ pingSent: { message: string; timestamp: string } }];
  ITEM_CREATED: [{ itemCreated: Item }];
  // add more topics here as your schema grows
};

export const pubsub = createAppPubSub<PubSubTopics>();
```

To enable Redis, add `REDIS_URL=redis://localhost:6379` to the package's `.env`. No code changes required.

## SDK Code Generation

All DS packages generate a shared TypeScript SDK (`TypedDocumentNode`) into `@corpdk/ds-sdk`, consumed by the UI packages.

```bash
pnpm --filter @corpdk/ds codegen        # regenerate from ds (Prisma)
pnpm --filter @corpdk/ds-hprt codegen   # regenerate from ds-hprt (Drizzle)
pnpm --filter @corpdk/ds-cdb codegen    # regenerate from ds-cdb (Couchbase)
pnpm --filter @corpdk/ds-mongo codegen  # regenerate from ds-mongo (MongoDB)
pnpm --filter @corpdk/ds-ddb codegen    # regenerate from ds-ddb (DocumentDB)
pnpm --filter @corpdk/ds-file codegen   # regenerate from ds-file (file-based)
```

Turbo runs codegen automatically before every build.

## Environment Variables

Each package reads from its own `.env`. See `.env.example` in each package for required variables.

| Package | Key Variables |
|---------|--------------|
| `ds` | `DS_PORT`, `DATABASE_URL` |
| `ds-hprt` | `DS_HPRT_PORT`, `DS_HPRT_DATABASE_URL` |
| `ds-cdb` | `DS_CDB_PORT`, `DS_CDB_CONNECTION_STRING`, `DS_CDB_USERNAME`, `DS_CDB_PASSWORD`, `DS_CDB_BUCKET` |
| `ds-mongo` | `DS_MONGO_PORT`, `DS_MONGO_URL`, `DS_MONGO_DB_NAME` |
| `ds-ddb` | `DS_DDB_PORT`, `DS_DDB_URL`, `DS_DDB_DB_NAME` |
| `ds-file` | `DS_FILE_PORT`, `DS_FILE_DATA_DIR`, `DS_FILE_FORMAT` |
| `ui` | `DS_HTTP_URL`, `NEXT_PUBLIC_DS_WS_URL` |
| `ui-hprt` | `DS_HTTP_URL`, `NEXT_PUBLIC_DS_WS_URL` |

No port defaults — all values must be explicitly configured.
