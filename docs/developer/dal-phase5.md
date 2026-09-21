# DAL Phase 5 — Driver errors, constraints, fragments, PG types

Phase 5 extends `@corpdk/dal-core` and `@corpdk/dal-codegen` with SQLSTATE mappers, Drizzle constraint metadata, GraphQL fragment-aware column projection, and additional PostgreSQL scalar mappings from [dal-pg-type-mapping.md](dal-pg-type-mapping.md).

## P1 — SQLSTATE driver mappers

`mapDriverError(err, dialect?)` in `@corpdk/dal-core` maps driver errors to `MutationUserError` using dialect-specific SQLSTATE / errno codes (PostgreSQL, CockroachDB, MySQL, SQLite) with safe messages per [Appendix B](graphql-dal-requirements.md#appendix-b--mutationusererror-code-taxonomy-and-delivery). Generated repositories pass `"postgresql"` for the DS template.

Heuristic message fallback remains when no code is present.

## P2 — Constraint metadata v2

Codegen infers from Drizzle:

| Source | Metadata |
| ------ | -------- |
| `varchar` / `char` `.length` | `maxLength` on `ColumnModel` |
| Table `check()` SQL referencing a column | `minExclusive: 0` for `> 0`, `minInclusive: 0` for `>= 0` |

GraphQL field descriptions append `Validation: …` hints. Generated repositories call `validateColumnConstraints` before insert/update.

## P3 — ColumnProjection + fragments

`collectEntityFieldSelection` resolves `FRAGMENT_SPREAD` and inline fragments via `info.fragments`, so named fragments on list/get/connection selections drive SQL column projection.

## P5 — Extra PostgreSQL types

Supported in codegen model + filters + repository wire helpers (v1 subset):

- **Int family:** `smallint`, `integer` → GraphQL `Int`, `IntFilter`
- **Float family:** `real`, `doublePrecision` → `Float`, `FloatFilter`
- **Wire scalars:** `bigint`, `numeric`/`decimal`, `date`, `timetz`, `interval` → custom scalars and filters per type reference
- **Hard bans:** plain `timestamp`, plain `time`, `money` fail codegen with explicit errors

Deferred (unchanged): network, geometric, PostGIS opt-in scalars; PG interval ↔ ms conversion at the Drizzle read layer (wire uses `IntervalMs`; DB binding remains dialect-specific).

## Commands

```bash
pnpm --filter @corpdk/dal-core build
pnpm --filter @corpdk/dal-core test
pnpm --filter @corpdk/dal-codegen build
pnpm --filter @corpdk/dal-codegen test
pnpm --filter @corpdk/ds dal:codegen
pnpm --filter @corpdk/ds build
```

## Related

- [Phase 4](dal-phase4.md) — filter-field index enforcement
- [GraphQL DAL Requirements §2.9](graphql-dal-requirements.md#29-field-validation-v1) — validation scope
