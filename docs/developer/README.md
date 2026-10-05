# Developer Guides

Implementation guides, coding patterns, and standards for contributors to the coding-templates monorepo. Start with the monorepo overview to understand the workspace, then consult the coding guidelines and git conventions before submitting changes.

---

## Contents

| Document                                                        | Description                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [01-monorepo-overview.md](01-monorepo-overview.md)              | Repo layout, package reference, root scripts                                                          |
| [02-graphql-schema.md](02-graphql-schema.md)                    | SDL directory layout, docstring rules, entity file pattern                                            |
| [03-repository-pattern.md](03-repository-pattern.md)            | IRepository interface, 4-step entity add guide                                                        |
| [04-pubsub-internals.md](04-pubsub-internals.md)                | `createAppPubSub` factory, topic definition, resolver wiring                                          |
| [11-ds-subscription-sse.md](11-ds-subscription-sse.md)          | `@corpdk/ds` subscriptions over SSE (UI migration deferred)                                           |
| [05-ui-architecture.md](05-ui-architecture.md)                  | UI template state and app-level configuration                                                         |
| [06-ui-status.md](06-ui-status.md)                              | Living capability status matrix across all UI packages                                                |
| [07-git-conventions.md](07-git-conventions.md)                  | Conventional Commits format and examples                                                              |
| [08-coding-guidelines.md](08-coding-guidelines.md)              | Code style, component patterns, review checklist                                                      |
| [09-enhancement-backlog.md](09-enhancement-backlog.md)          | Future improvements for UI and DS packages                                                            |
| [dal-entity-design.md](dal-entity-design.md)                    | Drizzle entity table design — audit profiles, relations, indexes, schema scope                        |
| [dal-pg-type-mapping.md](dal-pg-type-mapping.md)                | PostgreSQL → DAL type mapping — PG types, `ID` for uuid, custom scalars (`IntervalMs`, etc.), filters |
| [graphql-dal-requirements.md](graphql-dal-requirements.md)      | GraphQL DAL requirements — inference rules, queries, mutations, filters, pagination                   |
| [ds-automation-upgrades.md](ds-automation-upgrades.md)          | `@corpdk/create-ds` init / upgrade for DAL-automated DS packages                                      |
| [dal-phase2.md](dal-phase2.md) … [dal-phase5.md](dal-phase5.md) | Phase delivery notes — filters, cursors, index lint, driver errors                                    |

---

## Design Principles

- **Repository Pattern** — resolvers call repository methods, never DB-specific APIs directly. **`templates/ds`**: generated repos in `src/generated/dal/` via `pnpm dal:codegen`
- **GraphQL SDL** — manual DS variants use `src/schema/*.graphqls`; **`templates/ds`** emits merged SDL at `src/generated/generated-schema.ts` and DAL resolvers/pubsub under `src/generated/dal/` from Drizzle schema (see [02-graphql-schema.md](02-graphql-schema.md))
- **Pure ESM for DS packages** — `module: NodeNext` with explicit `.js` extensions on imports
- **Component size limits** — Pages < 100 lines, Views < 250 lines, UI components < 50 lines

---

**Related**: [Documentation Index](../00-index.md) | [Architecture](../architecture/README.md) | [Contributing](../10-contributing.md)

**Last updated**: October 5, 2026
