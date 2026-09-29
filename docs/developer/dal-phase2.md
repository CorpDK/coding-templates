# DAL Phase 2 — FilterAST, Relations, Bulk Ops

Phase 2 extends `@corpdk/dal-core` and `@corpdk/dal-codegen` with shared query translation, relation navigation, and bulk mutations.

## Architecture

```text
GraphQL filter input
  → FilterAST (Record tree + budget validation)
  → QueryTranslator (scalar builders + association EXISTS/join subqueries)
  → QueryEngine (list / count / connection / findByIds)
  → Drizzle SQL
```

Generated repositories delegate list/count/connection to **QueryEngine**; CRUD and bulk methods call QueryEngine for filter compilation.

## Relations

- Parsed from Drizzle `relations()` via `extractTablesRelationalConfig`.
- Inferred kinds: **many-to-one**, **one-to-one**, **one-to-many**, **many-to-many** (pure junction tables only — enriched junctions like `itemTags` stay 1:M to the junction entity).
- SDL: navigation fields on output types; FK scalars hidden from output.
- Resolvers: per-request **DataLoader** instances in `createDalContext()`; M:1/1:1 use `findByIds`, 1:M use `findBy<Parent>Ids`, inverse 1:1 use `findOneBy<Parent>Ids`.

## Association filters

- 1:M / M:N (when filterable): `<Child>AssociationFilter { some, every, none }`.
- M:1 / 1:1: nested `<RelatedEntity>Filter` on the navigation field name.

## Bulk mutations

| Mutation | Union / result | Notes |
| -------- | -------------- | ----- |
| `bulkCreate` / `bulkUpdate` | `BulkCreate/Update<Entity>Result` | `atomic` default: true when ≤100 items |
| `bulkDelete` | `BulkDelete<Entity>Result` | Success = `BulkDeleteCountPayload` |
| `bulkUpdateByFilter` / `bulkDeleteByFilter` | `BulkMutationResult!` | Always atomic; requires confirm flag on empty filter |

Env: `DAL_BULK_FILTER_MAX` (default **1000**) caps filter-based bulk matched rows.

## Commands

```bash
pnpm --filter @corpdk/dal-core build
pnpm --filter @corpdk/dal-codegen build
pnpm --filter @corpdk/ds dal:codegen
pnpm --filter @corpdk/ds codegen
```

## Phase 3

See [dal-phase3.md](dal-phase3.md) — HMAC cursors, ColumnProjection, `entity:lint`.
