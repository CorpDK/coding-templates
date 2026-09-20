# DAL Phase 3 — Cursor Signing, ColumnProjection, Entity Lint

Phase 3 extends `@corpdk/dal-core` and `@corpdk/dal-codegen` with optional HMAC cursor signing, GraphQL selection-set column projection, and a standalone entity design linter.

## HMAC cursor signing (§13)

| Env | Behavior |
| --- | -------- |
| **`DAL_CURSOR_SECRET` unset** | Cursors are Base64url JSON only (backward compatible local dev) |
| **`DAL_CURSOR_SECRET` set** | Wire format `{base64urlPayload}.{hmacSha256Signature}`; unsigned or tampered cursors → validation error |

Implementation lives in `@corpdk/dal-core` (`cursor-signing.ts`, `pagination.ts`). Generated repositories and `QueryEngine.listConnection` use `encodeCursor` / `decodeCursor` automatically.

Document `DAL_CURSOR_SECRET` in the DS `.env.example`.

## ColumnProjection (§17.2)

`QueryEngine.list`, `listConnection`, and `findByIds` accept an optional **ColumnProjection** derived from the GraphQL selection set:

- **Always selected:** `id`; soft-delete columns when the entity uses soft delete
- **When requested:** business scalars and audit columns present in the client selection
- **Navigation:** FK columns included when a M:1 / 1:1 navigation field is selected (DataLoader keys)
- **Sort keys:** drizzle columns for the active sort (including implicit `id` tie-breaker) on list/connection queries

**Not projected:** count, aggregate, bulk mutation success payloads (full rows per spec).

Codegen passes `GraphQLResolveInfo` from generated query resolvers into repository methods.

## `entity:lint` CLI

```bash
pnpm --filter @corpdk/dal-core build
pnpm --filter @corpdk/dal-codegen build
pnpm --filter @corpdk/ds entity:lint
pnpm --filter @corpdk/ds dal:codegen
```

Validates Drizzle domain entities per [DAL Entity Design Guidelines](dal-entity-design.md):

- UUID `id` PK and audit profile (via shared `loadEntities` validation)
- Boolean physical names (`is_*` / `has_*`)
- Enum member casing (UPPERCASE / SCREAMING_SNAKE_CASE)
- Soft-delete column shape (`deletedBy` requires `deletedAt`)
- Sort index hints: **warn** on `createdAt` / `updatedAt` without covering indexes; **`strict: true`** in `dal/dal.config.yaml` treats all sort columns (except `id`) as errors and enforces comment rules at load time

Exit code **1** when any **error**-severity violation is present; warnings alone exit **0**.

Bin: `dal-entity-lint` (`templates/ds` script: `entity:lint`).

## Out of scope (Phase 4+)

- Filter-field index enforcement v2
- Full SQLSTATE driver mappers beyond current
- `@src/db` path aliases
