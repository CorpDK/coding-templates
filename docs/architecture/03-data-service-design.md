# Data Service Design

Rationale behind the DS variant structure and guidance on selecting the right backend for a project.

---

## Why Multiple DS Variants?

Each DS variant wraps the same GraphQL Yoga server with a different storage backend. The GraphQL API surface is identical across all variants — the same schema, the same operations, the same SDK. Only the storage layer differs.

This design means:
- A project can swap backends by selecting a different DS template — no UI changes required
- Each variant is optimised for its storage backend (native drivers, connection pooling, schema patterns)
- The Repository Pattern ensures resolvers are storage-agnostic (see [Repository Pattern](../developer/03-repository-pattern.md))

---

## Variant Comparison

| Package | Storage | ORM / Driver | Real-time | Best for |
|---------|---------|--------------|-----------|---------|
| `@corpdk/ds` | PostgreSQL / MySQL / SQLite / CockroachDB | Prisma | Standard | Most relational projects; Prisma's type safety + migrations |
| `@corpdk/ds-hprt` | PostgreSQL / MySQL / SQLite / CockroachDB | Drizzle | High-performance | Relational projects with high-frequency real-time updates; lower overhead than Prisma |
| `@corpdk/ds-cdb` | Couchbase Capella / self-hosted | Native SDK + Zod | Yes | Couchbase-native projects; N1QL queries, full-text search |
| `@corpdk/ds-mongo` | MongoDB Atlas / self-hosted | Native driver + Zod | Yes | MongoDB projects requiring native driver performance; no ORM overhead |
| `@corpdk/ds-ddb` | DocumentDB (documentdb.io) | Native driver + Zod | Yes | MongoDB wire-protocol compatible storage on DocumentDB |
| `@corpdk/ds-file` | JSON or YAML file on disk | fs/promises + Zod | Yes | Zero external dependencies; prototyping, offline-first, embedded |

---

## Storage Selection Guide

### Use `ds` (Prisma) when:
- You want Prisma's type-safe query builder, schema migrations, and broad database support
- Your workload is standard CRUD without extreme real-time update frequency
- You value Prisma Studio and its developer tooling ecosystem

### Use `ds-hprt` (Drizzle) when:
- Your application streams high-frequency real-time data (live dashboards, trading, telemetry)
- You need Drizzle's lower query overhead and more direct SQL control
- You are pairing with `ui-hprt` (urql + Graphcache) for end-to-end real-time performance

### Use `ds-cdb` (Couchbase) when:
- Your organisation runs Couchbase Capella or a self-hosted Couchbase cluster
- You need N1QL, full-text search, or Couchbase's multi-dimensional scaling

### Use `ds-mongo` (MongoDB) when:
- Your workload suits document storage and you want native driver performance
- You run MongoDB Atlas or self-hosted MongoDB
- You do not need Prisma ORM overhead (use `ds` with Prisma's MongoDB connector if you prefer Prisma)

### Use `ds-ddb` (DocumentDB) when:
- You are running DocumentDB (documentdb.io) which uses the MongoDB wire protocol
- Requirements are identical to `ds-mongo` but your infrastructure is DocumentDB

### Use `ds-file` when:
- You are prototyping or building a demo with zero infrastructure dependencies
- You need offline-first or embedded storage
- The data volume fits comfortably in JSON/YAML files

---

## Why Pure ESM for DS Packages

All DS packages use `"type": "module"` and `module: NodeNext` in `tsconfig.json`. This is required by GraphQL Yoga v5, which is a pure ESM package. Mixing CommonJS and ESM module resolution in Node.js introduces subtle runtime errors; using `NodeNext` throughout each DS package is the only reliable approach.

Consequence: all TypeScript imports within DS packages must use explicit `.js` extensions, even for `.ts` source files. This is a Node.js ESM requirement, not a TypeScript quirk.

---

## Why the Repository Pattern

The Repository Pattern (`IItemRepository` interface + `itemRepository` implementation in `src/db/repository.ts`) is mandatory in all DS packages because:

1. **Storage-agnostic resolvers** — resolvers in `schema.ts` call `itemRepository.findAll()` regardless of whether the backend is Prisma, Drizzle, MongoDB, or a file. This makes the GraphQL layer identical across all DS variants.
2. **Testability** — the interface can be stubbed in tests without hitting a database.
3. **Validation boundary** — Zod parsing happens in resolvers, before data enters the repository. Repository methods return validated application types, not raw ORM/driver types.

See [Repository Pattern](../developer/03-repository-pattern.md) for the full implementation guide.

---

## Generated CLI (`ds-cli`)

Every DS variant runs `graphql-codegen` with the `@corpdk/codegen-cli` preset alongside the standard `client` preset. This generates three files in `templates/ds-cli/src/generated/` (and the equivalent path in scaffolded projects):

| File | Purpose |
|------|---------|
| `index.js` | Executable CLI — zero runtime dependencies (native `fetch` + `WebSocket`) |
| `man/ds-cli.1` | groff man page — `man ./src/generated/man/ds-cli.1` |
| `info/ds-cli.texi` | Texinfo source — compile with `makeinfo` |

All command names, descriptions, and argument documentation are derived directly from the GraphQL schema docstrings. Regenerate by running `pnpm codegen` whenever the schema changes.

### CLI interface

Each query, mutation, and subscription becomes a top-level subcommand (field name converted to kebab-case):

```bash
my-app items                                 # query — prints JSON
my-app create-item --name "Widget"           # mutation — prints JSON
echo '{"name":"Widget"}' | my-app create-item  # mutation — variables from stdin
my-app create-item --input vars.json         # mutation — variables from file
my-app item-created --count 3               # subscription — streams 3 NDJSON events then exits
```

Variable merging order: `--input <file>` → piped stdin → explicit flags (flags win).

### Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `DS_HTTP_URL` | — | HTTP endpoint for queries and mutations |
| `DS_WS_URL` | — | WebSocket endpoint for subscriptions |

### How it's wired

`codegen.ts` in each DS package adds a third output target:

```typescript
"../ds-cli/src/generated/": {
  preset: "@corpdk/codegen-cli",
  presetConfig: {
    httpUrlEnvVar: "DS_HTTP_URL",
    wsUrlEnvVar: "DS_WS_URL",
  },
},
```

The preset lives in `libraries/codegen-cli/` and is compiled with `tsup`. The `codegen` Turbo task declares `dependsOn: ["@corpdk/codegen-cli#build"]` so the preset is always compiled before any DS runs codegen.

### Scaffolded binary name

After scaffolding, the binary name is renamed from `ds-cli` to the project name. For a project named `my-app` the installed binary is `my-app`, not `my-app-cli`.

---

**Related**: [Repository Pattern](../developer/03-repository-pattern.md) | [System Overview](01-system-overview.md) | [Storage / UI Matrix](../user/04-storage-ui-matrix.md)

**Last updated**: March 31, 2026
