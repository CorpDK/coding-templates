# Moved

Former monolithic spec; split September 2026.

## Capabilities

DAL automation codegen produces:

- Auto-generated GraphQL SDL with **descriptions from DB object comments** — see [GraphQL DAL Requirements §2.11](docs/developer/graphql-dal-requirements.md#211-database-object-comments)
- **graphql.org-aligned naming** — noun-based queries (`items`, `item(id:)`, `itemConnection`), Payload-wrapped mutations with **`userErrors: [MutationUserError!]!`**, camelCase filter logical operators, boolean `is`/`has` prefixes (no negated boolean names), navigation-only relation output — see [§7.1 Naming convention](docs/developer/graphql-dal-requirements.md#71-naming-convention)
- **Two-tier mutation error delivery** — top-level GraphQL `errors` for system/infrastructure failures; payload `userErrors` for validation, business rules, and recoverable constraint violations — see [§9.0 Mutation error delivery](docs/developer/graphql-dal-requirements.md#90-mutation-error-delivery-two-tier-model)
- **Association filters** — field names match output navigation fields (`lines`, `tags`); `some`/`every`/`none` on 1:M and M:N; M:1 uses nested entity filters — see [§10.6 Association filters](docs/developer/graphql-dal-requirements.md#106-association-filters)
- **Null filters** — `isNull: Boolean` on nullable scalar/enum filters (mutually exclusive with other operators) — see [§10.4.1 Null filter operator](docs/developer/graphql-dal-requirements.md#1041-null-filter-operator-isnull)
- Typed repositories, resolver stubs, and filter/sort/pagination inputs derived from Drizzle schema
- Idempotent output under `src/generated/dal/` via `pnpm dal:codegen` (gitignored; Turbo runs before dev)

## Split docs

This spec has been split into:

- [Entity Design Guidelines](docs/developer/dal-entity-design.md)
- [DAL PostgreSQL Type Reference](docs/developer/dal-pg-type-mapping.md)
- [GraphQL DAL Requirements](docs/developer/graphql-dal-requirements.md)
