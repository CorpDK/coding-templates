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

## Scaffolding a New Project

`pnpm create-app` scaffolds a new full-stack GraphQL project from the templates in this repo. It supports two modes: an **interactive** guided prompt flow for local setup, and a **non-interactive** flag-driven mode suitable for CI and scripting.

```bash
pnpm create-app          # interactive
pnpm create-app --help   # show all flags
```

### Interactive Mode

Run `pnpm create-app` with no flags. You will be guided through nine steps:

1. **Project name** — lowercase letters, numbers, and hyphens; must start with a letter (e.g. `my-app`)
2. **Org scope** — your npm organisation scope without `@` (e.g. `myorg`)
3. **Output directory** — where to write the project (default: `./<name>`)
4. **Data service (DS)** — choose the backend stack:
   - `none` — no backend (UI-only mode)
   - `standard` — GraphQL Yoga + Prisma
   - `hprt` — GraphQL Yoga + Drizzle (high-performance real-time)
   - `cdb` — GraphQL Yoga + Couchbase + Zod
5. **Database** — shown only for `standard` or `hprt`; defaults to PostgreSQL
6. **UI** — `none`, `standard` (Apollo Client), or `hprt` (urql + Graphcache); options filtered by DS choice
7. **External SDK** — only prompted when UI is set and DS is `none`; must be a published scoped package (e.g. `@acme/ds-sdk`)
8. **Generate `.env` files** — copy `.env.example` → `.env` in each package (default: yes)
9. **Init git repository** — run `git init` and create an initial commit (default: yes)

### Non-Interactive Mode

Pass `--name` (or `-n`) to enter non-interactive mode. All prompts are replaced by flags:

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--name` | `-n` | required | Project name |
| `--scope` | `-s` | required | Org scope without `@` |
| `--output` | `-o` | `./<name>` | Output directory |
| `--ds` | — | `none` | `none \| standard \| hprt \| cdb` |
| `--db` | — | `postgresql` | `postgresql \| mysql \| sqlite \| cockroachdb \| mongodb` |
| `--ui` | — | `none` | `none \| standard \| hprt` |
| `--sdk` | — | — | External SDK package (required when `--ui` ≠ `none` and `--ds none`) |
| `--no-env` | — | — | Skip `.env` generation |
| `--no-git` | — | — | Skip git init |
| `--yes` | `-y` | — | Accept all defaults |
| `--help` | `-h` | — | Show usage |

### DS / UI / DB Compatibility

| DS | Compatible UI | Supported databases |
|----|---------------|---------------------|
| `standard` | `standard` only | PostgreSQL, MySQL, SQLite, CockroachDB, MongoDB (Prisma) |
| `hprt` | `hprt` only | PostgreSQL, MySQL, SQLite, CockroachDB (Drizzle — no MongoDB) |
| `cdb` | `standard` or `hprt` | Couchbase built-in — SDK auto-remapped to `ds-sdk-cdb` |
| `none` | `standard` or `hprt` | — requires `--sdk` pointing to a published npm package |

### Examples

```bash
# Full monorepo — HPRT stack (PostgreSQL)
pnpm create-app --name my-app --scope myorg --ds hprt --ui hprt

# Standard stack with MySQL
pnpm create-app --name my-app --scope myorg --ds standard --db mysql --ui standard

# Couchbase DS + HPRT UI
pnpm create-app --name my-app --scope myorg --ds cdb --ui hprt

# DS only, no UI — standard stack with SQLite
pnpm create-app --name my-api --scope myorg --ds standard --db sqlite

# Standalone UI with an externally published SDK
pnpm create-app --name my-ui --scope myorg --ui standard --sdk @acme/ds-sdk

# Bare project — no DS, no UI
pnpm create-app --name my-app --scope myorg
```

### After Scaffolding

```bash
cd <outputDir>
pnpm install
# Edit .env files in each package with your credentials
pnpm codegen   # monorepo only — generate TypedDocumentNode SDK types
pnpm dev       # start all selected packages
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
