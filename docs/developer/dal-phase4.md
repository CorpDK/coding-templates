# DAL Phase 4 — Filter-Field Index Enforcement v2

Phase 4 extends `entity:lint` and the **`strict: true`** codegen gate with **filter-field and association** index coverage checks ([§17.1 v2](graphql-dal-requirements.md#171-index-enforcement-codegen-time)).

## Filter-field index rules

Codegen reads **Drizzle** `index()`, `uniqueIndex()`, and primary-key definitions via `getTableConfig`. A column is **covered** when:

- It is the **primary key** (`id`), or
- A **single-column** index includes the column, or
- A **composite** index lists the column as its **leading** key (filter heuristic; sort checks still allow any index position)

### Columns validated

| Source | Table | Columns |
| ------ | ----- | ------- |
| Scalar filters | Entity | Every **filterable** scalar ([`filterableColumns`](../../libraries/dal-codegen/src/generators/schema-utils.ts) — business fields; excludes server-managed audit/soft-delete and FK scalars omitted from GraphQL output) |
| M:1 / 1:1 owner | Entity | **Owner FK** columns on relations used in nested filters |
| One-to-many association | **Child** entity | **Child FK** referencing the parent |
| Many-to-many association | **Join** table | Both **join-table FK** columns |

Sort-column checks from [Phase 3](dal-phase3.md) are unchanged: default mode warns on `createdAt` / `updatedAt`; **`strict: true`** errors on any sort column except `id`.

## Severity and exit codes

| Mode | Filter gaps | Sort gaps (non-`id`) |
| ---- | ----------- | --------------------- |
| **Default** (`strict: false`) | **WARN** (`FILTER_INDEX`) | **WARN** (`SORT_INDEX`) on `createdAt` / `updatedAt` only |
| **`strict: true`** | **ERROR** | **ERROR** (`SORT_INDEX`) on all columns except `id` |

Exit code **1** when any **error**-severity violation is present (including `SCHEMA_LOAD` and design rules from Phase 3).

Lint code: **`FILTER_INDEX`**.

## Commands

```bash
pnpm --filter @corpdk/dal-core build
pnpm --filter @corpdk/dal-codegen build
pnpm --filter @corpdk/ds entity:lint
pnpm --filter @corpdk/ds dal:codegen   # when strict: true, fails if entity:lint would error
```

## Codegen gate

When **`strict: true`** in `dal/dal.config.yaml`, `dal:codegen` runs the same **`runEntityLint`** path as `entity:lint` after schema load. Any error-severity violation aborts codegen (no duplicate rule logic).

## CI

Workflow [`.github/workflows/dal.yml`](../../.github/workflows/dal.yml) runs `@corpdk/dal-core` and `@corpdk/dal-codegen` tests plus `@corpdk/ds entity:lint`.

## Out of scope (Phase 6+)

- `@src/db` path aliases
- Auth actor hook (P6)
- Multi-backend DAL

See [Phase 5](dal-phase5.md) for SQLSTATE mappers, constraint metadata v2, fragment projection, and extended PG types delivered in Phase 5.
