# Moved

Former monolithic spec; split September 2026.

## Capabilities

DAL automation codegen produces:

- Auto-generated GraphQL SDL with **descriptions from DB object comments** — see [GraphQL DAL Requirements §2.11](docs/developer/graphql-dal-requirements.md#211-database-object-comments)
- Typed repositories, resolver stubs, and filter/sort/pagination inputs derived from Drizzle schema
- Idempotent output committed under `src/generated/dal/` via `pnpm dal:codegen`

## Split docs

This spec has been split into:

- [Entity Design Guidelines](docs/developer/dal-entity-design.md)
- [DAL PostgreSQL Type Reference](docs/developer/dal-pg-type-mapping.md)
- [GraphQL DAL Requirements](docs/developer/graphql-dal-requirements.md)
