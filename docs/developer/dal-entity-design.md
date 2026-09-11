# Database Entity Design Guidelines

Conventions for authoring **Drizzle ORM schemas** that define persisted entity tables. The Drizzle schema is the **sole source of truth** — there are no parallel metadata files, YAML entity declarations, or Zod entity registries.

**Related:** [Developer Guides](README.md)

---

## Purpose

These guidelines ensure consistent, reviewable Drizzle table definitions across all DS packages. Every entity table must have a UUID primary key and predictable column conventions so audit profiles, delete strategy, relations, and index coverage can be inferred from the schema without manual configuration.

Schemas **must** conform to the rules in this document. Invalid schemas are rejected by **entity design validation** tooling (lint checks on Drizzle definitions and migration SQL) — unsupported column types, missing audit columns, and invalid enum casing **fail validation** with non-zero exit.

---

## Schema Scope

Entity tables belong in the **domain schema** — the Drizzle schema path that defines your application's business data model. Tables outside this scope are **infrastructure or operational objects**, not domain entities.

| Category | Definition | Schema placement |
| -------- | ---------- | ---------------- |
| **Entity table** | Any Drizzle table with UUID `id` PK and a valid audit profile (§ Required Entity Shape) | Domain schema path (e.g. `src/db/schema/`) |
| **Non-domain tables** | Migration metadata, DBA-only objects, ETL staging, analytics replicas, **auth session tables** | Separate schema path, auth-owned migrations, or DBA scripts — not alongside domain entity tables |

Every exported `pgTable` (or dialect equivalent) with a UUID `id` in the domain schema path is an **entity table** subject to the rules in this document. If a table is exported from the domain schema, it must conform to entity shape requirements.

### Cache storage (schema anti-pattern)

**Do not model application cache as database tables.** Cache belongs entirely outside the database:

| Store | Use when |
| ----- | -------- |
| **Redis** | Server-side cache, rate-limit counters, durable TTL semantics |
| **CDN** | Static or edge-cacheable assets |
| **Client InMemory** | Browser or app-local memoization |

**Forbidden:** SQL cache tables in Postgres, MySQL, SQLite, or any other backend — not in the domain Drizzle schema, not modeled as entity tables. If you need durable cache semantics with TTL and eviction, use **Redis** (or **CDN** for static assets) — not a SQL table.

### Session storage (schema placement)

**Sessions may be stored in a database** (Postgres, MySQL, SQLite, or other supported backend) — e.g. Auth.js `Session` / `Account` adapter tables.

| Concern | Rule |
| ------- | ---- |
| **Classification** | **Auth infrastructure**, not business domain data — do not model session tables as domain entity tables |
| **Typical placement** | Managed by auth middleware (Auth.js Drizzle/Prisma adapter) in a schema path **outside** the domain entity schema, or in migrations the auth layer owns — not alongside domain entity tables |

**Non-domain tables** live in separate migration tooling, DBA scripts, warehouse schemas, or auth-owned schema paths — not in `src/db/schema/` (or whatever path holds domain entities). They are not "excluded entities"; they are simply not part of the application **business** data model.

---

## Required Entity Shape

Every entity table **must** satisfy:

| Requirement | Rule |
| ----------- | ---- |
| **Primary key** | Column named **`id`**, type **`uuid`**, **NOT NULL**, primary key — **no exceptions** |
| **Audit columns** | Every table **must** declare a valid audit profile — **`full`** (four columns) or **`append-only`** (two columns). Tables with no audit columns or partial combinations fail validation (§ Audit Columns) |
| **Entity scope** | Every table is a first-class entity with a complete column contract. **Append-only** tables (§ Audit Columns) must not include update audit columns |
| **Join and lookup tables** | Junction tables and lookup tables are either modeled as full entities **or** represented only through Drizzle `relations()` on parent entities — never as undocumented orphan tables |
| **Naming** | Drizzle **`export const`** uses **camelCase plural** (`orders`, `auditEvents`); physical table names use **snake_case** (`orders`, `audit_events`). Column names use **camelCase** in Drizzle (`createdAt`, not `created_at`) |

Validation **fails** when a table lacks a UUID `id` primary key, lacks a valid audit profile, or uses an unsupported join-table pattern (§ Relations).

### Example — minimal entity (`full` audit)

```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
});
```

---

## Audit Columns

Audit profile is **inferred from column presence** — no per-entity audit configuration file. **Every entity table must declare exactly one valid audit profile.** There is no opt-out: tables without audit columns fail validation.

### Column names (exact)

| Column | Type | Nullable | Profiles |
| ------ | ---- | -------- | -------- |
| `createdAt` | `timestamp with time zone` (or dialect equivalent) | NOT NULL | **`full`**, **`append-only`** |
| `updatedAt` | `timestamp with time zone` | NOT NULL | **`full`** only |
| `createdBy` | `text` (or `varchar`) | NOT NULL | **`full`**, **`append-only`** |
| `updatedBy` | `text` (or `varchar`) | NOT NULL | **`full`** only |

Use these **exact camelCase names** in Drizzle column definitions.

### Inferred audit profiles

Only two profiles are valid. Any other column combination → **validation error**.

| Profile | Required columns | Update columns |
| ------- | ---------------- | -------------- |
| **`full`** | `createdAt`, `updatedAt`, `createdBy`, `updatedBy` (all four required) | `updatedAt` and `updatedBy` present — rows may be updated |
| **`append-only`** | `createdAt`, `createdBy` only — **`updatedAt` and `updatedBy` must be absent** | No update columns — rows are immutable after insert |

**Detection order:** if all four audit columns are present → **`full`**. Else if `createdAt` **and** `createdBy` are present **and** `updatedAt` **and** `updatedBy` are **absent** → **`append-only`**. Else → **validation fails**.

**Invalid partial combinations** (any subset that is neither **`full`** nor **`append-only`**) fail validation — e.g. timestamps without actor columns, actor columns without timestamps, three of four **`full`** columns, or mixing update timestamps with a missing `updatedBy`.

### Append-only entities

Use the **`append-only`** profile when rows are **immutable after insert** (audit logs, event streams, ledger entries, append-only history tables):

| Column | Required | Notes |
| ------ | -------- | ----- |
| `createdAt` | Yes | NOT NULL; `.defaultNow()` |
| `createdBy` | Yes | NOT NULL; populated from actor context at insert time |
| `updatedAt` | **Must be absent** | Do not add — presence opts the entity into **`full`** |
| `updatedBy` | **Must be absent** | Do not add — presence opts the entity into **`full`** |

**Column naming:** use the same camelCase Drizzle names as other profiles (`createdAt`, `createdBy`). Do **not** add `updatedAt` / `updatedBy` "for consistency" on append-only tables.

**Database behavior:** append-only tables must not have `UPDATE`-able row content — the schema forbids update audit columns. Inserts and deletes (when permitted) are allowed; row content never changes after insert.

**Deletes:** append-only means **no updates after insert**, not necessarily no deletes. Whether deletes are permitted is a design decision — soft delete via `deletedAt` and hard delete are both valid when explicitly designed.

### Example — append-only entity

```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: text('action').notNull(),
  payload: text('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
  // intentionally no updatedAt / updatedBy
});
```

### Authoring rules

* Set `createdAt` with `.defaultNow()` on both profiles. On **`full`**, also set `updatedAt` with `.defaultNow()` and update `updatedAt` on every row update.
* Never accept `createdBy`, `updatedBy`, `createdAt`, or `updatedAt` from untrusted input — the server owns these fields.
* When actor columns are present, unresolved actors default to **`"system"`** — never SQL NULL.
* On **`append-only`** entities, do not add `updatedAt` / `updatedBy` columns — doing so changes the inferred profile and permits row updates.

---

## Timestamps & UTC

All **instant** timestamp columns — audit fields (`createdAt`, `updatedAt`), soft-delete fields (`deletedAt`), and business event fields — are stored as **UTC**. No separate timezone column is required unless a specific business requirement demands it (e.g. a contractual "effective date in local jurisdiction" that is not derivable from UTC).

**Time-of-day with timezone** (e.g. store opening hours, daily cutoff) uses **`time with time zone`** (`timetz`) — not `timestamptz`. Instants and time-of-day are different concerns: `timestamptz` answers "when did this happen?"; `timetz` answers "what clock time (with offset) applies?".

### Database storage (instants — `timestamptz`)

| Concern | Rule |
| ------- | ---- |
| **Column type** | `timestamp with time zone` (`timestamptz` in PostgreSQL) or dialect equivalent — **always with timezone** |
| **Stored value** | Normalized UTC — the database converts incoming values to UTC on write |
| **Drizzle** | Use `timestamp('column_name', { withTimezone: true })` (or dialect equivalent) on every instant timestamp column |
| **Writes** | Always write UTC — use `new Date()` (JavaScript) or explicit UTC; never persist a "local time without offset" |
| **No timezone column** | Do **not** add a `timezone` or `tz` column on entity tables for audit or soft-delete timestamps |

Display in user-preferred timezones (e.g. "America/New_York") is a **presentation concern**, not a persisted column. `timestamptz` columns carry sufficient information for rendering in any locale.

### Time-of-day with timezone (`timetz`)

| Concern | Rule |
| ------- | ---- |
| **Column type** | `time with time zone` (`timetz` in PostgreSQL) |
| **Drizzle** | Use `time('column_name', { withTimezone: true })` |
| **Use when** | Recurring daily times that carry an offset (business hours, cutoff times) — **not** for audit or event instants |
| **Plain `time` (no TZ)** | **Unsupported** — validation fails; use `{ withTimezone: true }` |

### Interchange format

When timestamps leave the database (logs, exports, serialized payloads), use **ISO-8601 UTC with milliseconds and a `Z` suffix** — e.g. `2026-09-10T13:28:00.000Z`. Values with non-UTC offsets should be normalized to UTC before persistence.

---

## Soft Delete

Delete strategy is **inferred from column presence** — no separate `deleteStrategy` flag.

### Decision guide — soft vs hard delete

**Default rule: when in doubt → soft delete.**

#### Soft delete — add `deletedAt` + `deletedBy`

Use when the entity has **any** of:

| Trigger | Examples |
| ------- | -------- |
| PII or personal data | Users, customers, patients, employees |
| Financial / transactional value | Orders, invoices, payments, ledger entries |
| Regulatory / audit relevance | Contracts, consent records, access grants |
| Need to recover from accidental deletion | Any business-critical entity |
| "Who deleted what when" matters | Accountability / audit trail |

#### Hard delete — no `deletedAt` / `deletedBy`

Use **only when all** of the following are true:

- No PII
- No financial or regulatory retention need
- No audit trail requirement for deletion
- Safe to permanently remove

Examples: static reference/lookup tables (country codes, product categories with no personal tie).

**Application cache must never live in a database** — use **Redis**, **CDN** (static assets), or **client-side InMemory** only (§ [Cache storage](#cache-storage-schema-anti-pattern)). Audit logs and security events use the **`append-only`** profile (§ Audit Columns) — a separate concern from soft/hard delete.

Retention, archive, and purge after soft delete are **operational concerns** (scheduled jobs), not entity design — consult legal/compliance for retention schedules. GDPR erasure is a **separate legal process**; soft delete does not satisfy it.

### Soft-delete columns

| Column | Type | Required for soft delete |
| ------ | ---- | ------------------------ |
| `deletedAt` | `timestamp with time zone` | Yes — presence triggers soft delete |
| `deletedBy` | `text` (or `varchar`) | Optional — when present, populated on soft delete like other actor columns |

When **`deletedAt`** exists on a table:

* Delete operations set `deletedAt` (and `deletedBy` when present) instead of issuing a physical `DELETE`.
* All read queries exclude rows where `deletedAt IS NOT NULL` unless explicitly including deleted rows (admin/recovery paths only).
* `deletedBy` follows the same trust boundary as `createdBy` / `updatedBy` — server-populated, never client-supplied.
* **Permanent purge** (physical row removal) is an operational job — not part of normal delete paths.

When **`deletedAt`** is absent:

* Delete operations perform **hard delete** — physical row removal.

**Do not** add `deletedAt` without intending soft delete. **Do not** use partial soft-delete shapes (e.g. `deletedBy` without `deletedAt`) — validation fails.

---

## Column Types

Supported and unsupported PostgreSQL column types for entity tables. Entity design validation **fails** (non-zero exit) when an entity table uses an unsupported type — there is no design-review bypass.

### Supported column types

| PostgreSQL type | Drizzle builder | Typical use | Index for sort/filter |
| --------------- | --------------- | ----------- | --------------------- |
| `text`, `varchar`, `char`, `citext` | `text()`, `varchar()`, `char()` | Names, descriptions, actor IDs | Yes — when used in WHERE/ORDER BY |
| `smallint`, `integer` | `smallint()`, `integer()` | Counts, ordinals, amounts in cents | Yes |
| `bigint` | `bigint()` | Large integers, counters exceeding 32-bit | Yes |
| `numeric`, `decimal` | `numeric()`, `decimal()` | Monetary amounts, rates, fixed-precision decimals | Yes |
| `real`, `double precision` | `real()`, `doublePrecision()` | Measurements, scientific values | Yes |
| `boolean` | `boolean()` | Flags | Optional |
| `date` | `date()` | Calendar dates without time (birthdays, effective dates) | Yes — when used in sort/filter |
| `timestamp with time zone` (`timestamptz`) | `timestamp(..., { withTimezone: true })` | All instant timestamps (audit, soft-delete, business events) — **only** instant timestamp type allowed | Yes — when used in sort/filter |
| `time with time zone` (`timetz`) | `time(..., { withTimezone: true })` | Time-of-day with offset (business hours, daily cutoff) — **not** for instants | Yes — when used in sort/filter |
| `interval` | `interval()` | Durations (rare) — stored as PG `interval`; application code converts to total milliseconds when needed | Optional |
| `bigint` (duration) | `bigint()` | Durations stored as **milliseconds** (preferred over `interval` for new schemas) | Optional |
| `uuid` | `uuid()` | Primary keys, foreign keys — opaque identifiers | Yes — FK columns always indexed |
| `pgEnum(...)` | `pgEnum()` | Constrained string values | Yes — when filtered or sorted |

**Primary keys:** always **`uuid`** with `.defaultRandom()`. Do **not** use `serial` or `bigserial` as PK — validation fails.

**Instants:** use **`timestamptz` only** (`{ withTimezone: true }`) for all instant timestamps. Plain `timestamp` (without timezone) and plain `time` (without timezone) are **unsupported** — validation fails.

**Time-of-day:** use **`timetz`** (`time(..., { withTimezone: true })`) when a column stores clock time with offset — not for audit or event instants.

**Durations:** prefer a **`bigint`** column storing **total milliseconds** for new schemas. PostgreSQL **`interval`** is supported when present — application code converts between PG `interval` and total milliseconds on read/write. Do **not** store durations as `float` or `numeric`.

**Money:** PostgreSQL **`money`** is **unsupported** — entity validation **fails**. Never use `money()`. Store monetary amounts as **`integer` cents** (whole amounts) or **`numeric`/`decimal`** with explicit scale.

**Case-insensitive text:** `citext` (requires PostgreSQL `citext` extension) is supported — same semantics as `text` for storage; case-insensitive matching is a query concern.

**Specialized types:** network (`inet`, `cidr`, `macaddr`, `macaddr8`), geometric (`point`, `line`, `lseg`, `box`, `path`, `polygon`, `circle`), and PostGIS (`geometry`, `geography`) columns are supported but rare — see [Specialized types (rare)](#specialized-types-rare).

### Unsupported column types

The following PostgreSQL types **fail validation** on entity tables. Normalize to supported column types, child tables, Redis, or object storage:

| Category | Unsupported types |
| -------- | ----------------- |
| **JSON** | `json`, `jsonb` |
| **Binary** | `bytea` |
| **Arrays** | All array variants (`text[]`, `int[]`, `uuid[]`, etc.) |
| **Serial PKs** | `serial`, `bigserial` (as PK or business column) |
| **Plain timestamp** | `timestamp` without time zone |
| **Plain time** | `time` without time zone |
| **Money** | `money` — **hard ban**; use `integer` cents or `numeric`/`decimal` |
| **Full-text** | `tsvector`, `tsquery` |
| **Range** | `int4range`, `int8range`, `numrange`, `tsrange`, `tstzrange`, `daterange` — see [Range normalization](#range-normalization) |
| **Other** | `xml`, `bit`, `varbit`, `oid`, `pg_lsn`, `name`, user-defined composite types, domain types (unless thin alias of a supported base) |

Prefer typed columns or normalized child tables over storing unstructured or multi-valued data in a single column.

### Range normalization

PostgreSQL **range types are not supported** on entity tables in v1 — validation fails. Model bounded intervals as **two scalar columns** instead:

| Instead of | Use |
| ---------- | --- |
| `tstzrange` effective period | `effectiveFrom` + `effectiveTo` — both `timestamptz`, nullable for open bounds |
| `int4range` quantity band | `minQty` + `maxQty` — both `integer`, nullable for open bounds |
| `daterange` calendar span | `startDate` + `endDate` — both `date`, nullable for open bounds |

Document open-bound semantics in column comments (e.g. `NULL` upper bound = unbounded). Two columns index cleanly and support full filter/sort on existing scalar types.

### Specialized types (rare)

Network, geometric, and PostGIS column types are **supported but rare** — use only when the domain requires them. They are not in default entity templates:

| Category | PostgreSQL types | Drizzle builder | Notes |
| -------- | ---------------- | --------------- | ----- |
| **Network** | `inet`, `cidr`, `macaddr`, `macaddr8` | custom / extension | IP and MAC address storage |
| **Geometric** | `point`, `line`, `lseg`, `box`, `path`, `polygon`, `circle` | custom | Native PostgreSQL geometry types |
| **PostGIS** | `geometry`, `geography` | PostGIS extension | Requires PostGIS extension |

### UUID keys

* All primary keys and foreign keys use **`uuid`** type in PostgreSQL.
* Generate PKs with `.defaultRandom()` (PostgreSQL `gen_random_uuid()`) or application-layer UUID v4.
* Store UUIDs in lowercase canonical form when written by application code.
* Validate RFC 4122 format in application code before INSERT/UPDATE — do not rely on clients or upstream parsers to enforce UUID shape.

### Defaults

Use Drizzle `.default()` / `.defaultNow()` on column definitions. Defaults apply before `INSERT` when the caller omits the field. Explicit caller values always win. Defaults do **not** re-apply on `UPDATE` (absent field = no change).

---

## Enums

Define enums with Drizzle `pgEnum` (or dialect equivalent). Enum **member values** must use **UPPERCASE** or **SCREAMING_SNAKE_CASE** — single-word members are all caps (`ACTIVE`); multi-word members use underscores (`IN_PROGRESS`).

```typescript
import { pgEnum, pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const orderStatusEnum = pgEnum('order_status', ['PENDING', 'ACTIVE', 'ARCHIVED']);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: orderStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
});
```

| Concern | Rule |
| ------- | ---- |
| **Enum name** | Lowercase snake_case in PostgreSQL (`order_status`); PascalCase TypeScript export (`orderStatusEnum`) |
| **Values** | **UPPERCASE** single word (`ACTIVE`) or **SCREAMING_SNAKE_CASE** multi-word (`IN_PROGRESS`) — no spaces, no lowercase |
| **Default** | Use `.default('PENDING')` on the column — default must be a declared enum member |
| **Validation** | Entity design lint **fails** on lowercase or mixed-case enum member values |
| **Mutability** | Adding enum values requires a migration; removing or renaming values requires a data migration plan |

Enum types should be documented in a **custom migration** with `COMMENT ON TYPE` when Drizzle does not yet expose a comment API on `pgEnum` — see [Database Object Comments](#database-object-comments-required).

---

## Database Object Comments (required)

Every **commentable** database object in the Drizzle schema **must** have a descriptive comment before applying migrations. Comments are the authoritative in-repo documentation for DBAs, operators, and schema authors — there are no parallel comment YAML files.

### Rule

| Concern | Rule |
| ------- | ---- |
| **When** | Before migration apply and during schema review |
| **Who** | Schema author |
| **Scope** | Every object listed below that the dialect and Drizzle API allow commenting on |
| **Validation** | Entity design lint checks comment presence — **warns** by default; **fails** in strict mode |

### Objects in scope

| Object | Required | Notes |
| ------ | -------- | ----- |
| **Schemas** | Yes (PostgreSQL) | `COMMENT ON SCHEMA` — use custom migration when not expressible in Drizzle |
| **Tables** (entities) | Yes | Drizzle `comment()` in `pgTable` extra-config callback |
| **Columns** | Yes | Drizzle `.comment('…')` on every column builder |
| **Views** | Yes | Same pattern as tables when using `pgView` / dialect equivalent |
| **Indexes** | Yes | `COMMENT ON INDEX` in custom migration until Drizzle index comment API is available |
| **Enums / custom types** | Yes (where supported) | `COMMENT ON TYPE` in custom migration when `pgEnum` lacks a comment API |
| **Constraints** | When API exists | Check / unique / FK constraint comments are **optional** — PostgreSQL has limited `COMMENT ON CONSTRAINT` support; document inline in table comment when constraint purpose is non-obvious |

### Comment content guidance

| Object | Include |
| ------ | ------- |
| **All objects** | Business purpose — what the object represents and how it fits the domain |
| **Columns** | Meaning, units (e.g. cents vs dollars), allowed-value hints, **PII flag** when applicable (`PII: email address`) |
| **Indexes** | Query pattern supported (filter, sort prefix, FK lookup, join-table owner lookup) |
| **Soft-delete tables** | Brief retention intent when non-obvious (e.g. "soft-deleted rows retained 7 years per policy") |
| **Append-only tables** | Immutability note — rows are never updated after insert (see § Audit Columns) |

Keep comments concise (one or two sentences). Prefer facts over restating the column name.

### Drizzle examples (PostgreSQL)

Column comments chain on the column builder; table comments use the `comment()` helper in the `pgTable` third-argument callback array:

```typescript
import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  text,
  timestamp,
  index,
  comment,
} from 'drizzle-orm/pg-core';

export const orderStatusEnum = pgEnum('order_status', ['PENDING', 'ACTIVE', 'ARCHIVED']);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom().comment('Surrogate primary key'),
  customerId: uuid('customer_id').notNull().comment('FK to customers.id'),
  total: integer('total').notNull().comment('Order total in cents (integer, not decimal)'),
  status: orderStatusEnum('status').notNull().default('PENDING').comment('Lifecycle: PENDING → ACTIVE → ARCHIVED'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }).comment('Soft-delete timestamp (UTC); NULL = active row'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow().comment('Row creation time (UTC)'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().comment('Last update time (UTC)'),
  createdBy: text('created_by').notNull().comment('Actor ID from request context; never client-supplied'),
  updatedBy: text('updated_by').notNull().comment('Actor ID from request context on last update'),
}, (table) => [
  comment('Customer purchase orders; soft-deleted rows retained per retention policy'),
  index('orders_customer_id_idx').on(table.customerId),
]);
```

Drizzle Kit emits PostgreSQL `COMMENT ON TABLE` / `COMMENT ON COLUMN` statements from the schema definitions above.

**Indexes, enums, and schemas** — add comments via custom migration SQL when Drizzle has no builder API:

```sql
COMMENT ON INDEX orders_customer_id_idx IS 'Filter/sort by customer';
COMMENT ON TYPE order_status IS 'Order lifecycle states';
COMMENT ON SCHEMA app IS 'Application-owned tables and views';
```

**Dialect note:** PostgreSQL and CockroachDB use `COMMENT ON …`; MySQL uses inline DDL comments; SQLite does not persist comments but they are still required in Drizzle for validation.

### Schema validation

Entity design lint **reads Drizzle comment metadata** and validates that every entity table and every column on those tables has a non-empty comment.

| Mode | Behavior |
| ---- | -------- |
| **Default** | **Warning** per table/column missing a comment |
| **Strict** | **Fail** (non-zero exit) — same gate as index coverage checks (§ Indexes) |

Index, view, enum, and schema comments are **author-checked** (custom migration SQL is not parsed by lint tooling). The pre-migration checklist below includes them.

---

## Relations

Define all associations with Drizzle `relations()`. Relations express foreign-key ownership and navigation between entity tables.

### One-to-one (1:1)

Model one-to-one associations explicitly with Drizzle `relations()` on the **principal** and **dependent** entity when both sides are navigated.

| Drizzle element | Rule |
| --------------- | ---- |
| FK column | On the owning/dependent table — a **distinct UUID column**, separate from the entity's `id` primary key, with `references()` to the principal entity's `id` |
| Owner side | Choose by lifecycle and dependency: optional extensions (profile, detail, settings) usually carry the FK to the principal; required, always-present attributes usually stay on the principal unless separate lifecycle, audit, access control, size, or operational behavior justifies a distinct entity |
| Cardinality | Enforce true 1:1 with a **unique constraint** or **unique index** on the FK column |
| Index | Index the FK column for joins and filters (in addition to the unique constraint when the database or query pattern needs it) |
| Primary key | Every entity table keeps a standard UUID `id` PK — **do not** use shared-primary-key one-to-one patterns |
| Relation properties | Singular on both sides (`user`, `profile`) |
| Dependent entity lifecycle | When the dependent row has separate lifecycle, audit, delete, retention, or access-control behavior, model it as its own entity with a valid audit profile and an explicit soft-delete/hard-delete decision |

Do not rely on implicit, undocumented, or convention-only one-to-one relationships.

```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  // ... audit columns
});

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    bio: text('bio'),
    // ... audit columns
  },
  (table) => [uniqueIndex('user_profiles_user_id_uniq').on(table.userId)],
);
```

In Drizzle `relations()`, declare singular navigation on both sides — e.g. `user.profile` and `profile.user`.

### Many-to-one (M:1)

The **owning** table carries the FK column (e.g. `customerId: uuid('customer_id').references(() => customers.id)`).

| Drizzle element | Rule |
| --------------- | ---- |
| FK column | Required on owning table; always `uuid` type with `references()` |
| Relation property | Singular name matching the parent entity (`customer`) |
| Index | Index the FK column when used in joins or filters |

### One-to-many (1:N)

Define on the **parent** entity via `relations()` pointing to the child table's FK.

| Drizzle element | Rule |
| --------------- | ---- |
| FK column | Lives on child table only — no duplicate FK scalar on parent |
| Relation property | Plural name matching child entity (`items`, `orderLines`) |

### Many-to-many (M:N)

Use an explicit **join table** in Drizzle with two FK columns referencing the parent entities:

```typescript
export const orderTags = pgTable('order_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  tagId: uuid('tag_id').notNull().references(() => tags.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
  updatedBy: text('updated_by').notNull(),
});
```

| Pattern | When to use |
| ------- | ----------- |
| **Join table as full entity** | The junction row has its own lifecycle, audit columns, or business fields beyond the two FKs — treat as a normal entity table |
| **Join table as relation-only** | Pure link table with only `id` + two FKs (no extra business columns). Still declare `relations()` on both parent entities and conform to entity shape (UUID `id`, audit profile) |

Index both FK columns on join tables. Add a unique constraint on `(ownerId, targetId)` when duplicate links are invalid.

**Join table patterns:**

| Scenario | Modeling |
| -------- | -------- |
| **Pure link** | `id` + two FKs + `relations()` on both parents |
| **Enriched junction** | Additional columns (`assignedAt`, `role`) — full entity with audit columns |
| **Implicit M:N** | Not supported — always use an explicit join table |

Relation property names use **camelCase** — singular for 1:1 and M:1 (`customer`, `profile`), plural for 1:N / M:N (`items`, `tags`). Broken `references()` targets fail validation.

---

## Indexes

Indexes are declared in Drizzle for query performance and to support common filter and sort patterns.

### Requirements

| Concern | Rule |
| ------- | ---- |
| **Primary key** | UUID `id` is implicitly indexed — no separate index required for PK lookups |
| **Sort columns** | Index scalar columns frequently used in `ORDER BY` |
| **Composite sorts** | When queries sort by `[fieldA, fieldB]`, a composite index should cover the **prefix through the last sort key** |
| **FK columns** | Always index M:1 FK columns used in joins or filters |
| **Join tables** | Index both FK columns on M:N join tables |
| **Soft-delete reads** | Consider partial indexes excluding deleted rows when `deletedAt IS NOT NULL` is common filter |

### Naming conventions

| Object | Pattern | Example |
| ------ | ------- | ------- |
| Single-column index | `{table}_{column}_idx` | `orders_customer_id_idx` |
| Composite index | `{table}_{col1}_{col2}_idx` | `orders_status_created_at_idx` |
| Unique constraint | `{table}_{column(s)}_uniq` | `users_email_uniq` |

### Index coverage validation

Entity design lint validates sort-field index coverage during schema validation.

| Mode | Behavior |
| ---- | -------- |
| **Default** | **Warn** when the **primary sort column** lacks a covering index — the first sort key, or **`id`** when no sort is given (default sort is ascending by `id`) |
| **Strict** | **Fail** when **any declared sort column** (except **`id`**, which is indexed as PK) lacks a covering index declared in Drizzle |

**Multi-sort:** when queries sort by multiple keys, a composite index must cover the prefix through the last sort key. The implicit **`id` tie-breaker** is assumed indexed (primary key) and is not validated separately.

---

## Anti-Patterns

| Anti-pattern | Why it fails |
| ------------ | ------------ |
| **Non-UUID primary key** (`serial`, composite PK) | UUID `id` is mandatory |
| **Parallel metadata files** | Drizzle is the only source of truth |
| **`json` / `jsonb` / `bytea` / arrays on entity tables** | Validation fails — use typed columns, child tables, Redis, or object storage |
| **`serial` / `bigserial` PK** | Validation fails — use `uuid` PK with `.defaultRandom()` |
| **Plain `timestamp` (no timezone)** | Validation fails — use `timestamptz` / `{ withTimezone: true }` only |
| **Plain `time` (no timezone)** | Validation fails — use `timetz` / `time(..., { withTimezone: true })` or `timestamptz` for instants |
| **PostgreSQL `money` type** | Entity validation **fails** — never use `money()`; store as `integer` cents or `numeric`/`decimal` with explicit scale |
| **Partial audit or soft-delete columns** | Must match **`full`**, **`append-only`**, or complete soft-delete pair |
| **`UPDATE` on append-only tables** | Schema forbids update columns — row content must not change after insert |
| **Hard delete on PII/financial entities** | Add `deletedAt` per § Soft Delete |
| **Undocumented tables/columns** | Comments required — lint warns or fails in strict mode |
| **Database cache tables** | Application cache belongs in **Redis**, **CDN**, or **client InMemory** only — never in the domain Drizzle schema or any database (§ [Cache storage](#cache-storage-schema-anti-pattern)) |
| **Session tables in domain schema** | Auth session stores belong in **auth infrastructure** (§ [Session storage](#session-storage-schema-placement)) — not alongside domain entity tables |
| **Infrastructure tables mixed with domain entities** | If a table is not business domain data → place it outside the domain schema path; if it is domain data → conform to entity shape requirements |
| **Lowercase enum member values** (`pending`, `in_progress`) | Entity design validation rejects — use `PENDING`, `IN_PROGRESS` (§ Enums) |
| **Implicit or uniqueness-free one-to-one relation** | Declare Drizzle `relations()`, put a UUID FK on the owning/dependent table, and enforce the FK with a unique constraint/index |
| **Shared-primary-key one-to-one entity table** | Keep a normal UUID `id` primary key on every entity table; use a distinct UUID FK plus uniqueness |

---

## Pre-Migration Checklist

Before applying migrations or opening a schema review PR, verify:

- [ ] **Schema scope decided:** domain entity tables in the domain schema path; **cache** → Redis / CDN / client InMemory only (never a database); **sessions** → auth infrastructure outside domain schema (§ [Cache storage](#cache-storage-schema-anti-pattern) and § [Session storage](#session-storage-schema-placement))
- [ ] Every table has **`id: uuid(...).primaryKey()`**
- [ ] Column names use **camelCase** in Drizzle (`createdAt`, `customerId`)
- [ ] Audit columns match **`full`** (all four) or **`append-only`** (`createdAt` + `createdBy` only) — no other combinations
- [ ] **Append-only** tables have **`createdAt` + `createdBy` only** (no `updatedAt` / `updatedBy`)
- [ ] **Soft delete or hard delete?** decision made per § Soft Delete (default: soft delete)
- [ ] Soft delete uses **`deletedAt`** (and optionally **`deletedBy`**) or neither
- [ ] Audit logs and security events use **`append-only`** profile
- [ ] All instant timestamp columns use **`timestamptz`** / `{ withTimezone: true }` — UTC only; no plain `timestamp` or plain `time`
- [ ] Time-of-day columns use **`timetz`** / `time(..., { withTimezone: true })` when needed — not for audit or event instants
- [ ] Durations use **`bigint` milliseconds** (preferred) or **`interval`** — not float
- [ ] Bounded intervals use **two scalar columns** — not PG range types (§ Range normalization)
- [ ] All business columns use **supported Drizzle types** (§ Column Types)
- [ ] **No PostgreSQL `money` columns** — use `integer` cents or `numeric`/`decimal` with explicit scale (§ Column Types)
- [ ] Enums use **`pgEnum`** with **UPPERCASE** / **SCREAMING_SNAKE_CASE** member values and `.default()` where defaults are required (§ Enums)
- [ ] **`relations()`** defined for every association between entities
- [ ] For every **one-to-one** association: owner/dependent side chosen and documented, distinct UUID FK separate from entity `id` and **unique**, lifecycle/delete/audit behavior explicit, relations defined on both sides when both sides are navigated
- [ ] FK columns on M:1 and 1:1 owners have **`references()`** and indexes (1:1 FK also has a **unique constraint**)
- [ ] M:N join tables have **UUID `id`** plus indexed FK columns
- [ ] **Indexes** cover expected sort prefixes and FK columns
- [ ] **All tables and columns** have Drizzle **comments** (§ Database Object Comments); indexes, enums, and schemas documented via Drizzle or custom migration SQL
- [ ] **No** parallel metadata files (`*.metadata.yaml`, Zod entity registries)

---

**Related:** [Developer Guides](README.md)

**Last updated:** September 11, 2026
