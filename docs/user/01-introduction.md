# Introduction

`coding-templates` is a pnpm + Turborepo monorepo that provides production-ready templates for full-stack GraphQL applications under the `@corpdk` org.

Use `pnpm create-app` to scaffold a new project from any combination of these templates.

---

## What Gets Scaffolded

`create-app` assembles a project from three layers:

| Layer | Templates | Description |
|-------|-----------|-------------|
| **UI** | `@corpdk/ui` | Next.js + Apollo Client (standard CRUD) |
| **UI** | `@corpdk/ui-hprt` | Next.js + urql + Graphcache (high-frequency real-time) |
| **Data Service** | `@corpdk/ds` | GraphQL Yoga + Prisma (relational SQL) |
| **Data Service** | `@corpdk/ds-hprt` | GraphQL Yoga + Drizzle (relational SQL, high-performance real-time) |
| **Data Service** | `@corpdk/ds-cdb` | GraphQL Yoga + Couchbase SDK + Zod |
| **Data Service** | `@corpdk/ds-mongo` | GraphQL Yoga + MongoDB native driver + Zod |
| **Data Service** | `@corpdk/ds-ddb` | GraphQL Yoga + DocumentDB (documentdb.io) + Zod |
| **Data Service** | `@corpdk/ds-file` | GraphQL Yoga + JSON/YAML file storage + Zod (zero external dependencies) |
| **SDK** | `@corpdk/ds-sdk` | Auto-generated TypedDocumentNode SDK shared by all DS variants |
| **CLI** | `@corpdk/ds-cli` | Auto-generated CLI for LLM/automation access (queries, mutations, subscriptions) |

You can scaffold a **full-stack** project (UI + DS), a **DS only** backend, or a **UI only** frontend that connects to an existing published DS.

---

## Scaffold Shapes

| Shape | What you get |
|-------|-------------|
| **Full-stack** | A monorepo with `packages/ui` + `packages/ds` + `packages/ds-sdk` + `packages/ds-cli` |
| **DS only** | A monorepo with `packages/ds` + `packages/ds-sdk` + `packages/ds-cli` |
| **UI only** | A standalone Next.js app pointing at a published `@scope/ds-sdk` |

---

## Next Steps

- [Interactive Mode](02-interactive-mode.md) — guided prompt walkthrough
- [CLI Reference](03-cli-reference.md) — non-interactive flags for CI/scripting
- [Storage / UI Matrix](04-storage-ui-matrix.md) — which DS and UI variants are compatible
- [Post-Scaffold Setup](05-post-scaffold-setup.md) — env files, codegen, and running the project
