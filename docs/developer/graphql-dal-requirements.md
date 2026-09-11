# GraphQL DAL Requirements

Requirements specification for a **standalone library/service pattern** that auto-generates a typed GraphQL data access layer from **hand-written Drizzle ORM schemas**.

**Related:** [DAL Entity Design Guidelines](dal-entity-design.md) — conventions for authoring Drizzle schemas that feed codegen | [DAL PostgreSQL Type Reference](dal-pg-type-mapping.md) — PG type coverage and scalar mapping

---

## Scope & Technology

This specification describes a **standalone library/service pattern** for auto-generated GraphQL data access. It is **not** a mandate to change existing `@corpdk` templates.

### In scope

| Layer | Technology |
| ----- | ---------- |
| ORM | **Drizzle ORM** |
| GraphQL server | **GraphQL Yoga** |
| Databases | **Drizzle-supported SQL databases** — PostgreSQL, MySQL, SQLite, CockroachDB, and similar |

### Out of scope

* Non-SQL backends (MongoDB, Couchbase, file storage, etc.)
* Raw SQL, direct Drizzle, or repository access from **application client code** (UI, BFF, external services)
* Per-backend query translators outside the Drizzle + SQL stack
* YAML/Zod entity metadata registries or `dal/entities/*.metadata.yaml` files
* GraphQL-excluded "internal" app tables — business tables the application needs must be PersistedEntity with full GraphQL API; **application cache is never in a database**; **sessions** are auth infrastructure (§2.12)

All query translation, filtering, pagination, and aggregation logic assumes Drizzle can express the operation against the target SQL dialect.

### Canonical terminology

| Term | Meaning |
| ---- | ------- |
| **PersistedEntity** | Storage-backed Drizzle table with UUID `id` PK, required audit columns (**`full`** or **`append-only`**), and optional soft-delete columns |
| **DrizzleSchema** | Hand-written Drizzle table, enum, index, and relation definitions — **sole source of truth** for codegen |
| **GeneratedDataAccess** | Auto-generated filter, pagination, and aggregate layer per entity |
| **QueryEngine** | Runtime component that executes GeneratedDataAccess operations |
| **QueryTranslator** | Maps a shared **FilterAST** to Drizzle query builders |
| **AssociationFilter** | Relation filters (`some` / `every` / `none`) for every Drizzle relation codegen can translate |
| **AssociationField** | GraphQL output navigation field for a Drizzle relation; resolved via per-request DataLoader, never via ColumnProjection |
| **ColumnProjection** | Column set derived from the GraphQL selection set that limits which scalar columns QueryEngine fetches from SQL |
| **EntityChangeEvent** | Unified subscription payload for create, update, and delete operations |
| **Application client** | Any code outside the DS server that consumes data — UI, BFF, background workers calling the GraphQL API. Must use GraphQL HTTP/WS only |
| **Non-app table** | Database object outside the codegen-scanned Drizzle schema — migration metadata, DBA-only, ETL staging, **auth session tables**. Never accessed as business data by application clients |
| **Application cache** | Ephemeral or TTL-backed cache state in **Redis**, **CDN**, or **client InMemory** — **never** database tables, PersistedEntities, or GraphQL |
| **Auth session store** | Server-side session persistence in a database (Postgres, MySQL, SQLite, or other supported DS backend) — e.g. Auth.js adapter tables — **auth infrastructure**, not business PersistedEntity unless admin GraphQL is explicitly required |

---

## 1. Overview

This document defines a **generic, entity-agnostic GraphQL Data Access Layer (DAL)** that provides:

* **GraphQL-only application access** — the generated GraphQL API (HTTP + WebSocket) is the sole application-facing data surface
* Fully abstracted database access via a **server-internal** repository boundary
* Strong typing (no arbitrary JSON inputs/outputs)
* Advanced filtering, pagination, sorting, and aggregation
* Auto-generated queries, mutations, and subscriptions
* **Drizzle-first** schema, API, and persistence mapping

Developers author **Drizzle schemas** once; `pnpm dal:codegen` emits GraphQL SDL, repository implementations, resolvers, and cursor codec constants. Audit profiles, delete strategy, filter/sort whitelists, relation exposure, and index validation are **inferred** from Drizzle — not declared in parallel metadata files.

**All paths to application data ultimately hit GraphQL.** `@corpdk/ds-sdk` and **ds-cli** are optional GraphQL client conveniences for ops and automation — they execute the same operations against the same API and do not bypass the GraphQL layer.

---

## 2. Drizzle Schema Inference Rules

Codegen reads configured Drizzle schema path(s) and derives all entity contracts automatically. See [DAL Entity Design Guidelines](dal-entity-design.md) for authoring conventions.

### 2.1 Input and output

| Concern | Rule |
| ------- | ---- |
| **Codegen input** | One or more Drizzle schema module paths (configured in workspace — e.g. `src/db/schema.ts` or `src/db/schema/`) |
| **Workspace config** | **`dal/dal.config.yaml`** only — workspace-wide flags such as index **`strict`** mode (§17.1) and filter complexity limits (§10.7); **not** per-entity metadata |
| **No parallel metadata** | No `dal/entities/*.metadata.yaml`, no EntityMetadata Zod registry, no YAML-to-Drizzle generation step |

### 2.2 Entity discovery

Every exported Drizzle `pgTable` / dialect table with a **UUID `id` primary key** in a codegen-scanned schema path becomes a **PersistedEntity** with the full auto-generated GraphQL API (list, get, mutations, subscriptions, filters, pagination, aggregation).

| Rule | Detail |
| ---- | ------ |
| **Discovery input** | All exported tables in configured Drizzle schema path(s) — no separate-file exclusion for app-accessible tables |
| **UUID `id` required** | Exported tables without UUID `id` fail codegen validation |
| **No hide flag** | v1 has **no entity hide flag** and **no ignore list** — every exported table with UUID `id` gets full generated CRUD |
| **App-accessible business data** | If the application needs a **business** table (domain entities, join tables, lookups), it **must** be a PersistedEntity here. **Application cache** is never in a database (§2.12). **Sessions** may be stored in a database as auth infrastructure outside this model (§2.12) |
| **Non-app tables** | Migration metadata, DBA-only objects, ETL staging live **outside** the scanned Drizzle schema — not as GraphQL exclusions |

See [DAL Entity Design Guidelines § Schema Scope](dal-entity-design.md#schema-scope) for schema-author guidance.

### 2.3 Audit profile inference

Inferred from **column presence** on each table. See [DAL Entity Design Guidelines § Audit Columns](dal-entity-design.md#audit-columns) for authoring conventions and examples.

**Every PersistedEntity must match exactly one valid profile.** Codegen **fails** on any other column combination.

| Profile | Required columns | Update mutations |
| ------- | ---------------- | ---------------- |
| **`full`** | `createdAt`, `updatedAt`, `createdBy`, `updatedBy` (all four required) | Generated |
| **`append-only`** | `createdAt`, `createdBy` only — **`updatedAt` and `updatedBy` must be absent** | **Omitted** (§7.3) |

**Detection order:**

1. All four audit columns present → **`full`**
2. `createdAt` **and** `createdBy` present **and** `updatedAt` **and** `updatedBy` absent → **`append-only`**
3. Any other combination → **codegen validation error**

| Edge case | Result |
| --------- | ------ |
| All four audit columns | **`full`** — update mutations generated |
| `createdAt` + `createdBy` only | **`append-only`** — update mutations omitted |
| No audit columns | **Codegen fails** — every entity requires audit columns |
| `createdAt` + `updatedAt` only (no actor columns) | **Codegen fails** — timestamps-only is not supported; use **`full`** |
| Three of four audit columns | **Codegen fails** — incomplete **`full`** profile |
| `createdBy` without `createdAt` | **Codegen fails** |
| `updatedAt` without `createdAt` | **Codegen fails** |
| `updatedBy` without `updatedAt` | **Codegen fails** |
| `createdAt` + `createdBy` + `updatedAt` without `updatedBy` | **Codegen fails** — mixes **`append-only`** with update timestamps |

Actor columns are never accepted from mutation input (§5).

### 2.4 Delete strategy inference

| Columns present | Strategy | Behavior |
| --------------- | -------- | -------- |
| **`deletedAt`** | **`soft`** | Soft delete mutations; reads exclude deleted rows unless `includeDeleted: true` |
| No `deletedAt` | **`hard`** | Physical `DELETE`; no `includeDeleted` parameter |

When `deletedBy` is also present, it follows the actor trust boundary (§5). `deletedBy` without `deletedAt` fails codegen.

**Authoring guidance:** PII-bearing, financial, audit-relevant, and regulatory entities should include `deletedAt` (soft delete). Hard delete is appropriate only for non-PII reference data with no retention requirement. See [DAL Entity Design Guidelines § Soft Delete](dal-entity-design.md#soft-delete).

### 2.5 Column types and PostgreSQL mapping

Codegen maps Drizzle column types to GraphQL scalars, filter inputs, sort fields, and aggregate selectors. PersistedEntity tables may use **only** column types marked **Supported** in [PostgreSQL type coverage](dal-pg-type-mapping.md#postgresql-type-coverage). All other PostgreSQL types **fail codegen** with an error naming the PG type and suggesting normalization (child table, Redis, object storage, etc.). See [DAL Entity Design Guidelines § Column Types](dal-entity-design.md#column-types) for schema-author guidance.

Full type coverage tables, PG → DAL mapping, custom scalar registry, and v1 scalar rationale: **[DAL PostgreSQL Type Reference](dal-pg-type-mapping.md)**.

#### 2.5.1 Scalar field inference

Every **supported** Drizzle column on a PersistedEntity ([supported types](dal-pg-type-mapping.md#postgresql-type-coverage)) becomes:

| Derived artifact | Rule |
| ---------------- | ---- |
| **GraphQL output field** | Mapped scalar or enum per [PG → DAL mapping](dal-pg-type-mapping.md#pg-dal-type-mapping) |
| **Filter input field** | **All scalar columns filterable by default** — typed filter input per column |
| **Sort enum member** | **All scalar columns sortable by default** — entry in `<Entity>Field` enum |
| **Create input** | Business scalars only — excludes **`id`** (server-generated via `.defaultRandom()`; client-supplied `id` on create is **never** allowed), all audit columns (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`), and soft-delete columns (`deletedAt`, `deletedBy`) |
| **Update input** | Business scalars only — excludes **`id`**, **`createdAt`**, **`createdBy`**, **`updatedAt`**, **`updatedBy`**, **`deletedAt`**, **`deletedBy`** (all server-managed); **not emitted** for **`append-only`** entities (§7.3) |
| **Aggregate selectors** | Numeric scalars → `NumericFields`; comparable scalars → `ComparableFields` per §15 |

Unsupported column types fail codegen ([PostgreSQL type coverage](dal-pg-type-mapping.md#postgresql-type-coverage)).

### 2.6 Enum inference

Drizzle `pgEnum` columns produce:

* GraphQL enum type (PascalCase type name; member values **UPPERCASE** or **SCREAMING_SNAKE_CASE**)
* `<Enum>Filter` with `eq`, `neq`, `in`, `notIn`
* Sort enum entry
* Create input default from Drizzle `.default()` when declared

**Value convention:** enum member values in Drizzle and GraphQL must be **UPPERCASE** (single word, e.g. `ACTIVE`) or **SCREAMING_SNAKE_CASE** (multi-word, e.g. `IN_PROGRESS`). Codegen emits GraphQL enum members with the **same strings** as declared in Drizzle `pgEnum` — no case transformation. See [DAL Entity Design Guidelines § Enums](dal-entity-design.md#enums).

Entity design validation and codegen **fail** when Drizzle enum member values are lowercase or mixed case.

Codegen validates Drizzle defaults against declared enum members. Invalid defaults fail codegen.

### 2.7 Relation inference

Every Drizzle `relations()` entry is **fully exposed on GraphQL**:

| Relation kind | GraphQL output | Filter | Loader |
| ------------- | -------------- | ------ | ------ |
| **One-to-one** | FK scalar + navigation field on dependent; singular navigation on principal | FK scalar filter + inverse association filter on principal | DataLoader keyed by `(Target, fkColumn)` — same batch pattern as M:1; Drizzle unique constraint on FK enforces cardinality |
| **Many-to-one** | FK scalar + navigation field | FK scalar filter + inverse association filter on parent | DataLoader keyed by `(Target, fkColumn)` |
| **One-to-many** | Navigation `[Target!]!` | `AssociationFilter` (`some` / `every` / `none`) | DataLoader batching child rows by parent FK |
| **Many-to-many** | Navigation `[Target!]!` on both sides | `AssociationFilter` → `EXISTS` on join table | DataLoader + join-table batch query |

Pure M:N **join tables** with UUID `id` (relation-only in Drizzle — only `id` + FKs, no extra business columns) are still full **PersistedEntities** with generated CRUD on GraphQL. "Relation-only" describes Drizzle modeling, not API visibility — see [DAL Entity Design Guidelines § Relations](dal-entity-design.md#relations).

There is **no opt-in `expose` flag**. If a relation should not appear on GraphQL, do not declare it in Drizzle `relations()`.

Relations that Drizzle cannot translate for filtering are **omitted from filter inputs only** — navigation fields and DataLoaders are still emitted when the relation is declared.

### 2.8 Index inference

Indexes declared via Drizzle (`index()`, `uniqueIndex()`, primary key) feed codegen-time **sort-field coverage validation** (§17.1). Composite indexes must cover multi-column sort prefixes. FK columns and join-table owner columns should be indexed for association filter performance.

### 2.9 Field validation (v1)

Inferred from Drizzle column constraints:

* **Nullability** — `notNull()` columns reject absent/null on create; update follows absent-vs-null semantics (§9.2)
* **Enum membership** — values must match Drizzle enum members exactly (case-sensitive; **UPPERCASE** / **SCREAMING_SNAKE_CASE** — §2.6)
* **Custom scalar parse** — `DateTime`, `Date`, `TimeTz`, `BigInt`, `Decimal`, `IntervalMs` (§3.1); **`ID`** parse for `uuid` columns (RFC 4122 at repository layer)

**No length, range, or regex constraints in v1.** Drizzle column length limits are not mirrored into GraphQL validation in v1.

**Planned v2:** constraint metadata from Drizzle column definitions (`length`, `check` constraints where expressible) enforced at GraphQL input validation and repository pre-write.

### 2.10 Enum defaults on create

When Drizzle declares `.default()` on an enum column:

| Concern | Rule |
| ------- | ---- |
| **Codegen** | Mirrors default in GraphQL SDL on create input (e.g. `status: OrderStatus = PENDING`) |
| **Repository** | Applies Drizzle default before INSERT when client omits field; explicit client value wins |
| **Update path** | Defaults do not re-apply — absent field means no change (§9.2) |

Non-enum Drizzle defaults follow the same repository fill-on-omit rule; GraphQL SDL mirroring applies to enum defaults in v1.

### 2.11 Database object comments

Database object comments are **schema author responsibility** — declared in Drizzle via `.comment()` on columns and `comment()` in the `pgTable` extra-config callback before codegen. See [DAL Entity Design Guidelines § Database Object Comments](dal-entity-design.md#database-object-comments-required) for objects in scope, content guidance, dialect notes, and Drizzle examples.

| Concern | Rule |
| ------- | ---- |
| **Source of truth** | Drizzle schema comments only — no parallel comment metadata files or separate GraphQL-only description files for generated entities |
| **Codegen validation** | Every PersistedEntity **table** and **column** must have a non-empty comment; default mode **warns**, **`strict: true`** in `dal/dal.config.yaml` **fails codegen** (same config flag as index enforcement — §17.1). Missing comments = missing GraphQL schema documentation |
| **GraphQL SDL output** | Codegen **auto-generates** GraphQL schema documentation from Drizzle DB object comments — embedded as `"""…"""` docstrings in generated SDL under **`src/generated/dal/`** |
| **Hand-written SDL** | Non-generated extensions in `src/schema/` still require manual docstrings per [GraphQL Schema docstrings](02-graphql-schema.md) |

**Comment → GraphQL documentation mapping (codegen):**

| Source (Drizzle) | Generated GraphQL documentation |
| ---------------- | ------------------------------- |
| PersistedEntity table `comment()` | `"""…"""` on GraphQL **object type** (e.g. `type Order`) |
| Column `.comment('…')` | `"""…"""` on GraphQL **output fields**, and on corresponding **filter input fields**, **sort enum** (if applicable), **create/update input fields** |
| `pgEnum` type comment (migration `COMMENT ON TYPE` or future Drizzle API) | `"""…"""` on GraphQL **enum type** and optionally enum value descriptions if stored |
| Operations (list, get, mutations) | Codegen-generated operation docstrings derived from entity/table comment + operation verb (e.g. "Returns a paginated list of Order entities.") |

Index, view, enum, and schema comments are enforced by author review and the entity-design pre-codegen checklist — custom migration `COMMENT ON …` SQL is not parsed by codegen in v1 except where noted for `pgEnum` type comments above.

GraphQL introspection, GraphiQL, and Altair display descriptions sourced from DB object comments on generated types, fields, and operations.

### 2.12 Application access boundary (GraphQL-only)

The generated GraphQL API is the **only** application-facing access surface for persisted data. All application clients — UI, BFF, external services — read and write data exclusively through GraphQL HTTP queries/mutations and WebSocket subscriptions.

```
Application client (UI, BFF, worker)
  → GraphQL HTTP / WebSocket
    → GraphQL Yoga resolvers
      → Generated repository (server-internal)
        → QueryEngine / Drizzle
          → SQL database
```

| Actor | Allowed access | Forbidden |
| ----- | -------------- | --------- |
| **Application runtime** (UI, BFF, services) | GraphQL HTTP/WS directly (Apollo, urql, `fetch`, etc.) | Raw SQL, Drizzle imports, repository imports, direct DB connections |
| **Ops / automation** | `@corpdk/ds-sdk` (TypedDocumentNode) or **ds-cli** — both are **GraphQL clients** that POST/WS to the same API | Treating SDK or CLI as a bypass around GraphQL |
| **DS server resolvers** | Generated repository methods only (§6.2) | Direct Drizzle or FilterAST from resolver code |
| **Non-app infrastructure** | Separate schemas/tools (migration runners, ETL, DBA scripts) | Placing non-app tables in the codegen-scanned Drizzle path |

**SDK and ds-cli positioning:** `@corpdk/ds-sdk` and **ds-cli** execute GraphQL operations against the same endpoint as application clients. They are optional conveniences for scripts, CI, and LLM automation — not alternate data-access layers. Production application code should prefer GraphQL HTTP/WS directly; SDK and CLI are for ops/automation workflows (see [Appendix A](#appendix-a--ds-cli-conventions)).

**Cache and session storage** — distinct from business PersistedEntity rules. See also [DAL Entity Design Guidelines § Cache storage](dal-entity-design.md#cache-storage-schema-anti-pattern) and [§ Session storage](dal-entity-design.md#session-storage-schema-placement).

#### Application cache (never in a database)

Application cache **must** be stored **completely** in **Redis**, **CDN**, or **client InMemory** — **never** in database tables (any SQL backend).

| Store | Typical use |
| ----- | ----------- |
| **Redis** | Server-side cache, rate limits, TTL/eviction, cross-instance shared ephemeral state |
| **CDN** | Static or edge-cacheable assets |
| **Client InMemory** | Apollo/urql cache, component memoization, browser sessionStorage where appropriate |

**Forbidden:** Database cache tables — not in the codegen-scanned Drizzle schema, not PersistedEntity, not GraphQL. Do not model cache rows as domain entities. For durable cache semantics (TTL, eviction, shared across instances), use **Redis** (or **CDN** for static assets).

#### Sessions (database allowed — auth infrastructure)

**Sessions may be stored in a database** (Postgres, MySQL, SQLite, or other supported DS backend) — e.g. Auth.js `Session` table. This is an allowed exception to the "everything through GraphQL" rule for **business data** only.

| Concern | Rule |
| ------- | ---- |
| **Scope** | **Auth infrastructure** — cookie + middleware lifecycle, not public business CRUD |
| **DAL / codegen** | Session tables are typically **outside** the codegen-scanned Drizzle schema, managed by the auth adapter (Auth.js Drizzle/Prisma adapter migrations) |
| **Client access** | Applications do not list/create/update/delete sessions via the public GraphQL API like domain entities |
| **Admin GraphQL (optional)** | Support or security tooling may expose **admin-only** session list/revoke operations — scoped resolvers, not standard generated public CRUD |

The GraphQL-only rule in this section applies to **application business data**. Sessions remain a server-internal auth concern unless an explicit admin GraphQL surface is designed.

---

## 3. Data Model Requirements

Every **PersistedEntity** includes at minimum:

* **`id`** — UUID primary key (mandatory)
* **Audit columns** per inferred **audit profile** (§2.3) — **`full`** (all four) or **`append-only`** (`createdAt` + `createdBy` only). Tables without a valid audit profile fail codegen.

Additional columns are inferred from Drizzle:

* Soft-delete columns per inferred **delete strategy** (§2.4)

### Example: `full` audit + soft delete

```
id, createdAt, updatedAt, createdBy, updatedBy, deletedAt, deletedBy, …business fields
```

### 3.1 Custom scalars

Codegen emits **six core custom scalars** in the generated base SDL ([custom DAL scalars registry](dal-pg-type-mapping.md#custom-dal-scalars-registry)): **`DateTime`**, **`Date`**, **`TimeTz`**, **`BigInt`**, **`Decimal`**, **`IntervalMs`**. Opt-in custom scalars (`Inet`, `GeoPoint`, `Geometry`, etc.) are emitted only when rare PG types appear in the Drizzle schema ([opt-in custom scalars](dal-pg-type-mapping.md#opt-in-custom-scalars-rare)).

Built-in GraphQL scalars (`Int`, `Float`, `String`, `Boolean`, **`ID`**) are used for supported PG types that do not require custom wire encoding ([PG → DAL mapping](dal-pg-type-mapping.md#pg-dal-type-mapping)).

#### GraphQL `ID` for `uuid` columns

PostgreSQL **`uuid`** columns map to GraphQL **`ID`** (built-in) — **not** a custom `UUID` scalar. **Only** `uuid` PG columns use `ID`; non-uuid string columns remain **`String`**.

| Concern | Rule |
| ------- | ---- |
| **Usage** | Entity PKs, FK columns, `IDFilter`, mutation `id` args, cursor keyset values, subscription `ids` |
| **Parse** | GraphQL `ID` accepts any opaque string; RFC 4122 validation at repository layer before SQL bind → **`BAD_USER_INPUT`** on malformed UUID |
| **Serialize** | Lowercase RFC 4122 string |
| **Tradeoffs** | See [UUID → ID tradeoffs](dal-pg-type-mapping.md#uuid--id-tradeoffs) |

#### `scalar DateTime`

All **instant** timestamp values — audit columns, soft-delete columns, and business date/time fields — are stored as **UTC** in the database and transmitted on the wire as **ISO-8601 UTC with milliseconds and a `Z` suffix**. No separate timezone column is required for entity timestamps; user display timezones are a UI concern. See [DAL Entity Design Guidelines § Timestamps & UTC](dal-entity-design.md#timestamps--utc).

| Concern | Rule |
| ------- | ---- |
| **Wire format** | ISO-8601 UTC with milliseconds and `Z` suffix — e.g. `2026-09-10T13:28:00.000Z` |
| **Usage** | Outputs, inputs, filters, cursors, aggregate min/max on `timestamptz` fields |
| **Storage** | Drizzle `timestamp with time zone` (`timestamptz` in PostgreSQL) — `{ withTimezone: true }`; values normalized to UTC on write |
| **Serialize** | Always normalize to UTC with `Z` suffix |
| **Parse** | Accept ISO-8601 strings (including offset forms); reject unparseable strings → **`BAD_USER_INPUT`**; Unix timestamps and timezone-less local strings without offset are **not** accepted (Appendix A) |
| **Timezone column** | Not generated — do not add per-entity timezone storage unless a documented business requirement exists |
| **Plain `timestamp` (no TZ)** | **Not supported** — codegen fails on columns without `{ withTimezone: true }`; **`timestamptz` only** for all instant timestamps |
| **Plain `time` (no TZ)** | **Not supported** — hard ban; use `timetz` or `timestamptz` |

#### `scalar TimeTz`

Time-of-day values with timezone offset — distinct from `DateTime` instants (which include a date) and `Date` calendar dates (which have no time).

| Concern | Rule |
| ------- | ---- |
| **Wire format** | ISO-8601 time with offset — e.g. `13:45:00.000+05:30` or `13:45:00Z` (no date component) |
| **Usage** | Outputs, inputs, filters, cursors, aggregate min/max on `timetz` fields |
| **Storage** | Drizzle `time({ withTimezone: true })` — PostgreSQL `timetz` |
| **Serialize** | ISO-8601 time with offset; preserve declared offset |
| **Parse** | Accept ISO-8601 time strings with offset; reject date components and unparseable strings → **`BAD_USER_INPUT`** |

#### `scalar Date`

Calendar dates without a time component — distinct from `DateTime` instants.

| Concern | Rule |
| ------- | ---- |
| **Wire format** | ISO-8601 calendar date — `YYYY-MM-DD` (e.g. `2026-09-10`) |
| **Usage** | Outputs, inputs, filters, cursors, aggregate min/max on `date` columns |
| **Storage** | Drizzle `date()` — PostgreSQL `date` |
| **Serialize** | `YYYY-MM-DD` |
| **Parse** | Valid calendar date; reject datetime strings with time components → **`BAD_USER_INPUT`** |

#### `scalar BigInt`

Large integers that exceed GraphQL `Int` (32-bit signed) range.

| Concern | Rule |
| ------- | ---- |
| **Wire format** | Decimal integer **string** — e.g. `"9223372036854775807"` |
| **Usage** | Outputs, inputs, filters, cursors, aggregate sum/avg/min/max on `bigint` columns |
| **Storage** | Drizzle `bigint()` — PostgreSQL `bigint` |
| **Serialize** | Decimal string; no scientific notation |
| **Parse** | Must match `/^-?\d+$/` and fit signed 64-bit range → **`BAD_USER_INPUT`** on violation |
| **Rationale** | Safer than mapping to `Int` (overflow) or `Float` (precision loss) |

#### `scalar Decimal`

Fixed-precision decimal values — monetary amounts, rates, quantities requiring exact arithmetic.

| Concern | Rule |
| ------- | ---- |
| **Wire format** | Decimal **string** — e.g. `"1234.56"`, `"99"`, `"-0.01"` |
| **Usage** | Outputs, inputs, filters, cursors, aggregate sum/avg/min/max on `numeric` / `decimal` columns |
| **Storage** | Drizzle `numeric()` / `decimal()` — PostgreSQL `numeric` |
| **Serialize** | Decimal string; preserve scale where possible |
| **Parse** | Valid decimal notation; scientific notation **not** accepted in v1 → **`BAD_USER_INPUT`** |
| **Rationale** | Avoids IEEE Float precision loss for financial and high-precision values |
| **PostgreSQL `money`** | **Not supported (hard ban)** — entity validation and codegen **fail**; use `integer` cents or `numeric`/`decimal`; see [PG type coverage](dal-pg-type-mapping.md#numeric) |

#### `scalar IntervalMs`

PostgreSQL `interval` durations — normalized to **total milliseconds** on the wire.

| Concern | Rule |
| ------- | ---- |
| **Wire format** | Signed decimal integer **string** of total milliseconds — e.g. `"3600000"`, `"-1500"` |
| **Usage** | Outputs, inputs, filters, cursors, aggregate min/max on `interval` columns |
| **Storage** | Drizzle `interval()` — PostgreSQL `interval`; repository converts PG interval ↔ total ms |
| **Serialize** | Total milliseconds as decimal string (signed 64-bit range) |
| **Parse** | Must match `/^-?\d+$/` and fit signed 64-bit range → **`BAD_USER_INPUT`** on violation |
| **Rationale** | JS/API convention, sub-second precision, avoids float; single fixed unit across all docs |

Alternative storage for durations in new schemas: `bigint` column holding milliseconds directly (maps to `BigInt` scalar) — see [DAL Entity Design Guidelines § Column Types](dal-entity-design.md#column-types).

---

## 4. Soft Delete Behavior

Delete strategy is inferred from Drizzle column presence (§2.4). **When to choose soft vs hard delete** is documented in [DAL Entity Design Guidelines § Soft Delete](dal-entity-design.md#soft-delete).

Entities with inferred **`soft`** delete strategy (`deletedAt` column present) follow these rules:

1. **`delete<Entity>`** and bulk delete mutations set `deletedAt` (and `deletedBy` when present) instead of removing the row — this is **operational soft delete**, not permanent erasure.
2. **All read paths** (`list`, `get`, `count`, `aggregate`, filter-based bulk preview counts) exclude soft-deleted rows by default.
3. **`includeDeleted: Boolean`** on list, connection, count, and aggregate operations opts in to deleted rows.
4. **`get<Entity>ById`** returns `null` for soft-deleted rows unless `includeDeleted: true` is passed.
5. Hard-delete entities use physical `DELETE`; no `includeDeleted` parameter is generated.

### Permanent purge is not via GraphQL

The DAL **does not expose permanent physical deletion** for soft-delete entities. GraphQL `delete` mutations only set `deletedAt`. After the compliance retention window:

* **Archive** and **hard purge** are performed by **scheduled retention jobs** outside the GraphQL API
* Purge jobs must be auditable, logged, and suspended during legal hold

See [DAL Entity Design Guidelines § Soft Delete](dal-entity-design.md#soft-delete) for the schema-author decision guide.

---

## 5. Actor Resolution

Every PersistedEntity has at least **`createdBy`** (both **`full`** and **`append-only`** profiles). **`updatedBy`** exists only on **`full`** profile entities. Soft-delete **`deletedBy`** follows the same trust boundary when present (§2.4).

### 5.1 Defaults

* **`createdBy`** and **`updatedBy`** (when present) default to **`"system"`** when no actor is resolved.
* Values are **never** accepted from mutation input — the trust boundary is server-side only.

### 5.2 Yoga plugin hook

GraphQL Yoga exposes a plugin hook:

```
resolveActor(context) → string | null
```

* Called on every create, update (when update mutations exist), and soft-delete write.
* Returns the authenticated actor identifier, or `null` (falls back to `"system"`).
* **Unconfigured hook** — when the Yoga plugin does not register `resolveActor`, the hook is treated as **missing** and behaves identically to returning `null` → **`"system"`** fallback. This is valid for local dev and tests.
* **Never SQL NULL** — every entity has `createdBy`; **`full`** entities also have `updatedBy`. The repository **always** writes a string value; unresolved actors become `"system"`, not database NULL.
* Future auth integrations implement this hook; generated resolvers do not embed auth logic.

### 5.3 Population rules

| Operation | Actor column |
| --------- | ------------ |
| Create | `createdBy` ← resolved actor; on **`full`** profile also `updatedBy` ← resolved actor |
| Update | `updatedBy` ← resolved actor (**`full`** profile only — no update path on **`append-only`**) |
| Soft delete | `deletedBy` ← resolved actor |

On **`append-only`** entities, only **`createdBy`** is populated (on create). There is no `updatedBy` column and no update mutation path.

---

## 6. Architecture

### 6.1 Library layout (planned)

| Package | Role |
| ------- | ---- |
| **`libraries/dal-core`** | Shared types: FilterAST, pagination cursors, aggregate descriptors, audit/delete enums, QueryTranslator interface, repository base contracts |
| **`libraries/codegen-cli` extension** | Reads Drizzle schema; emits GraphQL SDL fragments, GeneratedDataAccess, default repository impl, and resolver stubs |

This spec documents the **planned library architecture**. Implementation lives in these packages; consuming services compose them with GraphQL Yoga.

### 6.2 Repository boundary

The repository layer is **server-internal only**. Application clients **never** import or call repository classes — they use GraphQL exclusively (§2.12).

* GraphQL resolvers call **repository methods only** — never Drizzle or FilterAST directly.
* Codegen produces a **default repository implementation** per entity that delegates to **QueryEngine** / **GeneratedDataAccess**.
* The repository interface is **expanded** beyond minimal CRUD to cover list, connection, count, aggregate, and bulk operations — but **GraphQL is the only public API surface** for application data access.
* Custom behavior uses the **subclass override pattern** (§19): DS service authors extend `Generated<Entity>Repository` and override specific methods while calling `super.*` by default. Sealed internals (FilterAST, QueryTranslator wiring, cursor codec, bulk safety guards, actor column population) are not overridable.
* **No repository export to application clients** — repositories are wired inside the DS server package only; UI and external services consume the GraphQL schema, not repository TypeScript APIs.

### 6.3 Query translation pipeline

```
GraphQL filter input
  → validated & parsed to FilterAST (shared, backend-agnostic tree)
  → QueryTranslator (Drizzle-specific)
  → Drizzle query builder (.where(), .orderBy(), joins)
  → SQL execution via Drizzle
```

* **FilterAST** is shared across list, count, aggregate, and filter-based bulk operations.
* **QueryTranslator** is implemented once for Drizzle + SQL dialects; there is no per-database translator matrix beyond Drizzle's dialect support.
* **AssociationFilter** nodes are emitted for every Drizzle relation **and** Drizzle can express the required join/subquery.

### 6.4 GeneratedDataAccess / QueryEngine

Per entity, codegen emits:

* Filter input GraphQL types (Prisma-style recursive shape) — **all scalar columns**
* Sort field enum — **all scalar columns**
* Aggregate field selectors — inferred from scalar types
* A **QueryEngine** class wiring FilterAST → QueryTranslator → Drizzle

### 6.5 Codegen workflow

| Concern | Rule |
| ------- | ---- |
| **Schema input** | Configured Drizzle schema path(s) — not metadata YAML |
| **Workspace config** | Optional **`dal/dal.config.yaml`** for workspace-wide settings (e.g. index **`strict`** mode — §17.1; filter complexity limits — §10.7) |
| **Command** | `pnpm dal:codegen` |
| **Output** | Full idempotent regen into **`src/generated/dal/`** — **committed to version control** for reviewability |
| **Invalid schema** | **Fails codegen** (non-zero exit); CI treats this as a gate |
| **Turbo pipeline** | `dal:codegen` is a dependency of DS `codegen` and `build` tasks |
| **Local dev** | Optional **`--watch`** on the Drizzle schema directory for iterative regen |

Codegen parses Drizzle tables, enums, indexes, and relations, validates entity shape (UUID `id`, audit/delete column rules, database object comments — §2.11), emits GraphQL SDL fragments with docstrings from DB object comments (§2.11), GeneratedDataAccess, default repository implementations, resolver stubs, and cursor codec version constants per entity. Re-running codegen with unchanged schema produces byte-identical output (idempotent).

**`dal/dal.config.yaml` example:**

```yaml
strict: false  # when true, fail codegen on sort-field index gaps (§17.1) and missing table/column comments (§2.11)

# Runtime filter parse guards (§10.7) — omitted keys use documented defaults
filterMaxDepth: 2   # max nested logical / association filter levels (default: 2)
filterMaxNodes: 50  # max total nodes in a filter tree (default: 50)
```

### 6.6 Association output fields and DataLoaders

Association handling splits into three concerns: **output shape**, **filter translation**, and **resolver loading**.

#### Output shape (codegen)

**All Drizzle relations** receive GraphQL navigation fields:

| Association kind | GraphQL output |
| ---------------- | -------------- |
| **One-to-one** | FK scalar column + navigation field on dependent; singular navigation field on principal (`Target!` or `Target` per nullability) |
| **Many-to-one** | FK scalar column + navigation field (`Target!` or `Target` per nullability) |
| **One-to-many** | Navigation field `[Target!]!` |
| **Many-to-many** | Navigation field `[Target!]!` on each side with declared inverse relation |

FK scalar columns on M:1 owners are subject to ColumnProjection (§17.2).

#### Mandatory per-request DataLoader (N+1 policy)

Every **AssociationField** (navigation field) **must** resolve through a **per-request DataLoader** — never via direct Drizzle calls from the resolver (§6.2 preserved).

| Concern | Rule |
| ------- | ---- |
| **Scope** | One DataLoader instance per GraphQL request (Yoga context) |
| **Key** | `(targetEntity, foreignKeyColumn)` — one loader per distinct FK relationship |
| **Batch fn** | Batches into repository `findByIds` (many-to-one) or join-table batch queries (many-to-many) |
| **Resolver contract** | AssociationField resolvers call `loader.load(key)` only; repository boundary unchanged |

**Many-to-one example:** `Order.customer` → DataLoader keyed by `(Customer, customerId)` batches `customerRepository.findByIds([...])`.

**Many-to-many example:** `Order.tags` → DataLoader keyed by join-table semantics batches a single join-table query returning `Map<ownerId, Target[]>`.

List/get root resolvers return entity rows with FK scalars populated from SQL. Navigation fields on those rows defer to DataLoader on field resolution.

---

## 7. Auto-Generated API

For every entity `<Entity>`, the system auto-generates the operations below.

### 7.1 Naming convention

**Drizzle vs GraphQL entity names:**

| Layer | Convention | Example |
| ----- | ---------- | ------- |
| Drizzle **`export const`** | **camelCase plural** table symbol | `orders`, `auditEvents` |
| GraphQL **entity type** | **PascalCase singular** derived from table | `Order`, `AuditEvent` |

Canonical operation names follow the **`listEntity` / `getEntityById`** pattern:

| Canonical | Example |
| --------- | ------- |
| `list<Entity>` | `listItem` |
| `get<Entity>ById` | `getItemById` |
| `list<Entity>Connection` | `listItemConnection` |

During migration from legacy `@corpdk` naming, **deprecated alias fields** (e.g. prior query names) may be emitted alongside canonical names. Aliases delegate to the same resolver and are removed in a future major version.

### 7.2 Queries

* `list<Entity>`
* `list<Entity>Connection`
* `get<Entity>ById`
* `count<Entity>` (mandatory sugar — §15.6)
* `aggregate<Entity>`

### 7.3 Mutations

**Standard entities** (`full` audit profile):

* `create<Entity>`
* `bulkCreate<Entity>`
* `update<Entity>`
* `bulkUpdate<Entity>`
* `bulkUpdate<Entity>ByFilter`
* `delete<Entity>`
* `bulkDelete<Entity>`
* `bulkDelete<Entity>ByFilter`

**Append-only entities** (inferred when `createdAt` + `createdBy` present and `updatedAt` + `updatedBy` absent — §2.3):

| Generated | Omitted |
| --------- | ------- |
| `create<Entity>`, `bulkCreate<Entity>` | `update<Entity>` |
| `delete<Entity>`, `bulkDelete<Entity>`, `bulkDelete<Entity>ByFilter` | `bulkUpdate<Entity>` |
| | `bulkUpdate<Entity>ByFilter` |

Codegen does **not** emit `<Entity>UpdateInput`, `<Entity>UpdateEntry`, or `BulkUpdate<Entity>Result` union members for append-only entities. Delete mutations remain unless separately restricted (soft delete, custom repository overrides). See [DAL Entity Design Guidelines § Append-only entities](dal-entity-design.md#append-only-entities).

### 7.4 Subscriptions

* `<entity>Changed` — unified per entity (§14)

---

## 8. Query Design

### 8.1 Unified List

```graphql
list<Entity>(
  filter: <EntityFilter>
  sort: [<Entity>SortInput!]
  limit: Int = 100
  includeDeleted: Boolean
): [Entity!]!
```

**Limit rules:**

* Default: **`100`**
* Maximum: **`1000`** — values above max return a **validation error** (reject; do not clamp)
* Applies independently of connection pagination

---

### 8.2 Paginated List (Connection)

```graphql
list<Entity>Connection(
  filter: <EntityFilter>
  sort: [<Entity>SortInput!]
  first: Int
  after: String
  last: Int
  before: String
  includeDeleted: Boolean
): <Entity>Connection!
```

Example for `Item`:

```graphql
listItemConnection(
  filter: ItemFilter
  sort: [ItemSortInput!]
  first: Int
  after: String
  last: Int
  before: String
  includeDeleted: Boolean
): ItemConnection!
```

Connection pagination uses cursor-based keyset paging (§12–§13). The `limit` argument applies to non-connection `list` queries only.

#### Connection and Edge SDL

Relay-compatible connection shape with a convenience `nodes` field. **No `totalCount`** on Connection — use `count<Entity>` separately (§15.6).

```graphql
type ItemConnection {
  edges: [ItemEdge!]!
  nodes: [Item!]!
  pageInfo: PageInfo!
}

type ItemEdge {
  node: Item!
  cursor: String!
}
```

Codegen emits `<Entity>Connection` and `<Entity>Edge` per entity following this pattern.

#### Connection pagination defaults

| Rule | Value |
| ---- | ----- |
| Default **`first`** | **`100`** when only `after` is provided or neither `first` nor `last` is set |
| Default **`last`** | **`100`** when only `before` is provided (recommended; see §12.1) |
| Max **`first`** / **`last`** | **`1000`** — values above max return a **validation error** (reject; do not clamp) |
| **`first: 0`** / **`last: 0`** | Returns empty `edges` / `nodes` with valid `pageInfo` (not an error) |
| **`first` + `last` together** | **Forbidden** — validation error (Relay strongly discourages this; we reject it) |
| **`after` + `before` together** | **Allowed** — bounded window paging (Relay-allowed; see §12.1) |

See §12 for Relay conformance, execution semantics, and edge-ordering invariants.

---

### 8.3 Get By ID

```graphql
get<Entity>ById(
  id: ID!
  includeDeleted: Boolean
): Entity
```

Returns `null` when not found or soft-deleted (unless `includeDeleted: true`).

---

## 9. Mutations

### 9.0 Bulk union types (per entity)

ID-list bulk mutations return a **named per-entity union** (GraphQL requires named union types — no inline union syntax). Filter-based bulk mutations return **`BulkMutationResult!`** directly.

Codegen emits the following pattern per entity (example: `Item`):

```graphql
type ItemListPayload { items: [Item!]! }

type BulkDeleteCountPayload { count: Int! }

union BulkCreateItemResult = ItemListPayload | BulkMutationResult
union BulkUpdateItemResult = ItemListPayload | BulkMutationResult
union BulkDeleteItemResult = BulkDeleteCountPayload | BulkMutationResult

type BulkMutationResult {
  successCount: Int!
  failureCount: Int!
  errors: [BulkOperationError!]!
}

type BulkOperationError {
  id: ID
  message: String!
  code: String
}
```

* **`code`** — canonical string taxonomy defined in **Appendix B** (dal-core fixed union; GraphQL type remains `String`, not an enum).
* **`id`** — populated when the error maps to a **specific row** (ID-list bulk failures). **`null`** for filter-based bulk failures and other non-row-scoped errors.

---

### 9.1 Create

```graphql
create<Entity>(input: <EntityCreateInput!>): Entity!

bulkCreate<Entity>(
  inputs: [<EntityCreateInput!>]!
  atomic: Boolean
): BulkCreate<Entity>Result!
```

Create inputs include **business scalars only** and **exclude**:

| Excluded field | Reason |
| -------------- | ------ |
| **`id`** | Server-generated via Drizzle `.defaultRandom()` — client-supplied `id` on create is **never** allowed |
| **`createdAt`**, **`updatedAt`** | Auto-managed timestamps |
| **`createdBy`**, **`updatedBy`** | Server-populated actor columns (§5) |
| **`deletedAt`**, **`deletedBy`** | Soft-delete columns — server-managed |

Enum fields with Drizzle `.default()` appear with GraphQL default values (§2.10); omitted client values are filled by the repository before INSERT.

---

### 9.2 Update

```graphql
update<Entity>(id: ID!, input: <EntityUpdateInput!>): Entity!
```

Update inputs include **business scalars only** and **exclude** all server-managed fields:

| Excluded field | Reason |
| -------------- | ------ |
| **`id`** | Immutable primary key |
| **`createdAt`**, **`createdBy`** | Set once at insert — never mutable |
| **`updatedAt`**, **`updatedBy`** | Repository-managed on every update (§5) |
| **`deletedAt`**, **`deletedBy`** | Soft-delete columns — set only by delete mutations |

#### Null semantics

| Input state | SQL effect |
| ----------- | ---------- |
| **Field absent** | **No change** — column is not included in the UPDATE |
| **Field explicitly `null`** | **Set column to SQL NULL** |

Additional rules:

* **Nullable fields** appear as optional in `<EntityUpdateInput>` — omit to leave unchanged, pass `null` to clear.
* **Non-nullable fields** are **omitted from update input entirely** — they cannot be changed via update (create-only or immutable after create).
* Bulk update (`bulkUpdate`, `bulkUpdateByFilter`) follows the same absent-vs-null semantics per entry.

---

### 9.3 Bulk Update (Typed Map)

```graphql
input <Entity>UpdateEntry {
  id: ID!
  input: <EntityUpdateInput!>
}

bulkUpdate<Entity>(
  updates: [<Entity>UpdateEntry!]!
  atomic: Boolean
): BulkUpdate<Entity>Result!
```

---

### 9.4 Bulk Update by Filter

```graphql
bulkUpdate<Entity>ByFilter(
  filter: <EntityFilter!>
  input: <EntityUpdateInput!>
  confirmUpdateAll: Boolean
): BulkMutationResult!
```

Filter-based bulk operations are **always atomic** — the `atomic` flag does not apply.

---

### 9.5 Delete

```graphql
delete<Entity>(id: ID!): Boolean!

bulkDelete<Entity>(
  ids: [ID!]!
  atomic: Boolean
): BulkDelete<Entity>Result!

bulkDelete<Entity>ByFilter(
  filter: <EntityFilter!>
  confirmDeleteAll: Boolean
): BulkMutationResult!
```

---

### 9.6 Atomicity

Bulk mutations accept an optional **`atomic: Boolean`**:

| Scenario | Default | Behavior |
| -------- | ------- | -------- |
| ID-list bulk (`bulkCreate`, `bulkUpdate`, `bulkDelete`) with **≤ 100 items** | `atomic: true` | All succeed or all roll back |
| ID-list bulk with **> 100 items** | `atomic: false` | Best-effort per row; partial success allowed |
| Filter-based bulk (`*ByFilter`) | Always atomic | Single transaction; no `atomic` parameter |

When **`atomic: false`**, the mutation resolves to **`BulkMutationResult`** inside the per-entity union (see §9.0).

When **`atomic: true`** (or item count ≤ 100 with default):

* **`bulkCreate`** / **`bulkUpdate`** resolve to **`ItemListPayload`** (`items: [Entity!]!`) inside the per-entity union.
* **`bulkDelete`** resolves to **`BulkDeleteCountPayload`** (`count: Int!`) inside the per-entity union.

When **`atomic: false`**, all ID-list bulk mutations resolve to **`BulkMutationResult`**. Filter-based mutations always return **`BulkMutationResult!`** directly (no union).

**Bulk create/update success payloads always return full entity rows** — no ColumnProjection on mutation response paths in v1. Every field on the entity output type is populated in `ItemListPayload.items` regardless of client selection set (§17.2).

All atomic bulk operations and filter-based bulk operations run under the transaction rules in §9.8.

---

### 9.7 Filter-based bulk safety guards

Filter-based update and delete operations enforce:

1. **Empty filter → error** unless the caller passes an explicit confirm flag: `confirmUpdateAll: true` for update, `confirmDeleteAll: true` for delete.
2. **Hard cap on matched rows** — configurable via environment variable (default **`1000`**). If the filter matches more rows than the cap, the operation fails without modifying data.
3. Matched-row count is evaluated before any write inside the same transaction (filter-based ops are always atomic).

These guards apply to **`bulkUpdate<Entity>ByFilter`** (when generated) and **`bulkDelete<Entity>ByFilter`**. Append-only entities omit filter-based update mutations (§7.3).

---

### 9.8 Transactions and isolation (v1)

All **atomic** bulk mutations (ID-list with `atomic: true`, or default ≤ 100 items) and **all filter-based bulk operations** execute in a **single database transaction**.

| Concern | Rule |
| ------- | ---- |
| **Isolation level** | **`READ COMMITTED`** explicitly — not configurable in v1 |
| **Filter-based ops** | Matched-row **count** and **write** (update or delete) run in the **same transaction** |
| **Row-level locks** | Where the dialect supports it, matched rows are locked for the duration of the transaction (`FOR UPDATE` or dialect equivalent) before write |
| **Rollback** | Any validation failure, cap breach, or driver error rolls back the entire transaction |

Non-atomic ID-list bulk (`atomic: false`, > 100 items) uses **per-row transactions** — partial success is allowed and errors are collected in `BulkMutationResult`.

---

## 10. Filtering System

### 10.1 Prisma-style recursive filter inputs

Each entity filter input follows a **recursive shape** with logical combinators and per-field operators. **Every scalar column** inferred from Drizzle appears as a filter field:

```graphql
input <Entity>Filter {
  AND: [<Entity>Filter!]
  OR: [<Entity>Filter!]
  NOT: <Entity>Filter

  # All scalar columns — typed filter inputs per field
  name: StringFilter
  status: OrderStatusFilter
  quantity: IntFilter
  active: BooleanFilter
  createdAt: DateTimeFilter
  customerId: IDFilter

  # Association filters — one per Drizzle relation codegen can translate
  items: ItemAssociationFilter
}

input ItemAssociationFilter {
  some: ItemFilter
  every: ItemFilter
  none: ItemFilter
}
```

Logical operators and field filters compose recursively. There is no flat or SQL-string filter input.

### 10.2 Logical operators

* **AND** — conjunction of sub-filters
* **OR** — disjunction of sub-filters
* **NOT** — negation of a sub-filter (composes recursively with other logical operators)

**`neq` and `notIn` remain first-class scalar operators** (§10.3, §10.4) — they map directly to FilterAST leaf nodes and QueryTranslator emits Drizzle `.neq()` / `notInArray()`. For simple scalar negation, **prefer `neq` / `notIn`** over wrapping a single equality in `NOT { … }`. Use **`NOT`** when negating compound or association sub-filters that have no single-operator equivalent.

---

### 10.3 String filter

```graphql
input StringFilter {
  eq: String
  neq: String
  like: String
  in: [String!]
  notIn: [String!]

  caseInsensitive: Boolean
}
```

* **`ilike` is not used** — `like` with `caseInsensitive: true` provides case-insensitive matching.
* All string comparisons are parameterized via Drizzle; no client-supplied SQL fragments.

---

### 10.4 Other scalar filters

Strongly typed inputs (no JSON). Codegen emits one filter input type per supported scalar column ([PG → DAL mapping](dal-pg-type-mapping.md#pg-dal-type-mapping)):

| Filter input | Scalar columns | Operators |
| ------------ | -------------- | --------- |
| **`IntFilter`** | `smallint`, `integer` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn` |
| **`BigIntFilter`** | `bigint` | Same as `IntFilter`; values are **`BigInt`** (string on wire) |
| **`DecimalFilter`** | `numeric`, `decimal` | Same as `IntFilter`; values are **`Decimal`** (string on wire) |
| **`FloatFilter`** | `real`, `double precision` | Same as `IntFilter`; values are **`Float`** |
| **`BooleanFilter`** | `boolean` | `eq` |
| **`DateFilter`** | `date` | Same comparators as `IntFilter`; values are **`Date`** (`YYYY-MM-DD`) |
| **`DateTimeFilter`** | `timestamptz` | Same comparators as `IntFilter`; values are **`DateTime`** (ISO-8601 UTC) |
| **`TimeTzFilter`** | `timetz` | Same comparators as `IntFilter`; values are **`TimeTz`** (ISO-8601 time with offset) |
| **`IntervalMsFilter`** | `interval` | Same comparators as `IntFilter`; values are **`IntervalMs`** (ms string on wire) |
| **`IDFilter`** | `uuid` | `eq`, `neq`, `in`, `notIn` — values are GraphQL **`ID`**; RFC 4122 validated at repository layer |
| **Opt-in `*Filter`** | network, geometric, PostGIS scalars | v1: **`eq`, `neq` only** ([opt-in custom scalars](dal-pg-type-mapping.md#opt-in-custom-scalars-rare)) |

```graphql
input BigIntFilter {
  eq: BigInt
  neq: BigInt
  gt: BigInt
  gte: BigInt
  lt: BigInt
  lte: BigInt
  in: [BigInt!]
  notIn: [BigInt!]
}

input DecimalFilter {
  eq: Decimal
  neq: Decimal
  gt: Decimal
  gte: Decimal
  lt: Decimal
  lte: Decimal
  in: [Decimal!]
  notIn: [Decimal!]
}

input DateFilter {
  eq: Date
  neq: Date
  gt: Date
  gte: Date
  lt: Date
  lte: Date
  in: [Date!]
  notIn: [Date!]
}

input IDFilter {
  eq: ID
  neq: ID
  in: [ID!]
  notIn: [ID!]
}

input IntervalMsFilter {
  eq: IntervalMs
  neq: IntervalMs
  gt: IntervalMs
  gte: IntervalMs
  lt: IntervalMs
  lte: IntervalMs
  in: [IntervalMs!]
  notIn: [IntervalMs!]
}
```

All filter values are parameterized via Drizzle; no client-supplied SQL fragments.

---

### 10.5 Enum filter

Drizzle `pgEnum` columns produce a GraphQL enum, a sort enum entry, and a dedicated filter input per enum field.

```graphql
enum OrderStatus {
  PENDING
  ACTIVE
  ARCHIVED
}

input OrderStatusFilter {
  eq: OrderStatus
  neq: OrderStatus
  in: [OrderStatus!]
  notIn: [OrderStatus!]
}
```

| Rule | Detail |
| ---- | ------ |
| **Value convention** | GraphQL enum members mirror Drizzle `pgEnum` values — **UPPERCASE** or **SCREAMING_SNAKE_CASE** (§2.6) |
| **Matching** | Case-sensitive on enum **value** — filter `eq` / `in` / `notIn` must match Drizzle members exactly (e.g. `PENDING`, not `pending`); no `like` / case-insensitive variant |
| **ComparableFields** | **Enum fields are excluded** from `<Entity>ComparableFields` — min/max are meaningless (§15.2) |
| **Sort** | Enum fields appear in `<Entity>Field` sort enum |

---

### 10.6 Association filters

For every Drizzle relation codegen can translate:

* **`some`** — at least one related row matches
* **`every`** — all related rows match
* **`none`** — no related rows match

Association filter inputs are fully recursive (nested `<RelatedEntity>Filter`). If a relation cannot be translated to Drizzle, it is **omitted from the GraphQL filter schema** rather than exposed with runtime failure.

**Many-to-many:** `AssociationFilter` translates to an **`EXISTS` subquery** on the join table (inferred from Drizzle relation / join table definition).

See **§10.6.1** for end-to-end GraphQL and ds-cli examples on a multi-entity domain model.

#### 10.6.1 Examples — Order domain

The examples below use a realistic e-commerce slice inferred from Drizzle (§2.7). Relation names match codegen output from `relations()` declarations.

| Entity | Key columns | Relations |
| ------ | ----------- | --------- |
| **Order** | `id`, `status` (`OrderStatus`), `customerId`, `total`, `createdAt`, … | M:1 → **Customer** (`customerId`); O:M → **OrderLine** (`lines`) |
| **Customer** | `id`, `name`, `email`, `tier` (`CustomerTier`), … | inverse O:M → Order |
| **OrderLine** | `id`, `orderId`, `productId`, `quantity`, `status` (`OrderLineStatus`), … | M:1 → **Product** (`productId`) |
| **Product** | `id`, `name`, `category` (`ProductCategory`), … | inverse M:1 ← OrderLine |

```graphql
enum OrderStatus { PENDING ACTIVE ARCHIVED }
enum OrderLineStatus { OPEN FULFILLED CANCELLED }
enum CustomerTier { STANDARD VIP }
enum ProductCategory { ELECTRONICS APPAREL OTHER }
```

Filter inputs (abbreviated):

```graphql
input OrderFilter {
  AND: [OrderFilter!]
  OR: [OrderFilter!]
  NOT: OrderFilter
  status: OrderStatusFilter
  total: IntFilter
  customerId: IDFilter
  customer: CustomerFilter          # M:1 — direct nested filter (no some/every/none)
  lines: OrderLineAssociationFilter # O:M — AssociationFilter
}

input OrderLineAssociationFilter {
  some: OrderLineFilter
  every: OrderLineFilter
  none: OrderLineFilter
}

input OrderLineFilter {
  quantity: IntFilter
  status: OrderLineStatusFilter
  product: ProductFilter            # M:1 from OrderLine
}

input CustomerFilter {
  email: StringFilter
  tier: CustomerTierFilter
}

input ProductFilter {
  category: ProductCategoryFilter
}
```

**Translation cheat sheet** (QueryTranslator — §16):

| Pattern | Drizzle strategy |
| ------- | ---------------- |
| O:M `some` / `every` / `none` on child collection | **`EXISTS` / `NOT EXISTS` subquery** (or equivalent) on child table keyed by parent FK (`orderLine.orderId = order.id`) |
| M:1 nested filter on parent (`customer: { … }`) | **`INNER JOIN`** (or `EXISTS`) on related table via owner FK (`order.customerId = customer.id`) |
| M:N `some` / `every` / `none` | **`EXISTS` subquery** on join table (§10.6) |
| Nested association inside `some` / `every` / `none` | Composed subquery/join chain (child filter + related-table join) |

**FilterAST budgets** (§10.7): each example lists approximate **depth** (logical operators + association levels) and **nodes** (each association filter node + each leaf scalar predicate). Defaults: `filterMaxDepth: 2`, `filterMaxNodes: 50`.

---

##### Example 1 — `some` on one-to-many

**Intent:** Return orders that have **at least one line** with `quantity > 10`.

```graphql
query OrdersWithLargeLines {
  listOrder(
    filter: { lines: { some: { quantity: { gt: 10 } } } }
    sort: [{ field: CREATED_AT, direction: DESC }]
  ) {
    id
    status
    total
  }
}
```

**Filter structure:**

```json
{
  "lines": {
    "some": {
      "quantity": { "gt": 10 }
    }
  }
}
```

| Budget | Value |
| ------ | ----- |
| **Depth** | `1` — one association level (`lines` → `some`) |
| **Nodes** | `2` — `lines.some` association node + `quantity.gt` leaf |
| **Translation** | `EXISTS` subquery on `order_line` where `order_id = order.id` AND `quantity > 10` |

Connection variant: same `filter` on `listOrderConnection(first: 20, filter: { … })`.

---

##### Example 2 — `every` on one-to-many (nested M:1)

**Intent:** Return orders where **every line** is for a product in category **`ELECTRONICS`**.

```graphql
query AllElectronicsOrders {
  listOrder(
    filter: {
      lines: {
        every: {
          product: { category: { eq: ELECTRONICS } }
        }
      }
    }
  ) {
    id
    status
  }
}
```

**Filter structure:**

```json
{
  "lines": {
    "every": {
      "product": {
        "category": { "eq": "ELECTRONICS" }
      }
    }
  }
}
```

| Budget | Value |
| ------ | ----- |
| **Depth** | `2` — `lines` → `every` (association level 1) + nested `product` on `OrderLineFilter` (association level 2) — **at default `filterMaxDepth`** |
| **Nodes** | `3` — `lines.every`, nested `product`, `category.eq` leaf |
| **Translation** | Subquery for `every`: no child row fails the predicate — typically `NOT EXISTS` line where product category ≠ `ELECTRONICS`, composed with join/subquery to `product` on `order_line.product_id` |

---

##### Example 3 — `none` on one-to-many

**Intent:** Return orders with **no cancelled lines** (`OrderLineStatus.CANCELLED`).

```graphql
query OrdersWithoutCancelledLines {
  listOrder(
    filter: {
      lines: {
        none: { status: { eq: CANCELLED } }
      }
    }
  ) {
    id
    status
    total
  }
}
```

**Filter structure:**

```json
{
  "lines": {
    "none": {
      "status": { "eq": "CANCELLED" }
    }
  }
}
```

| Budget | Value |
| ------ | ----- |
| **Depth** | `1` — `lines` → `none` |
| **Nodes** | `2` — `lines.none` + `status.eq` leaf |
| **Translation** | `NOT EXISTS` subquery on `order_line` where `order_id = order.id` AND `status = 'CANCELLED'` |

Prefer **`none`** over `NOT { lines: { some: { … } } }` when expressing "no related row matches" — clearer intent and identical FilterAST cost.

---

##### Example 4 — M:1 nested filter from parent (no `some` / `every` / `none`)

**Intent:** Return orders whose **customer email** contains `@acme.com` (case-insensitive).

```graphql
query AcmeCustomerOrders {
  listOrder(
    filter: {
      customer: {
        email: {
          like: "%@acme.com"
          caseInsensitive: true
        }
      }
    }
  ) {
    id
    customerId
    customer { name email }
  }
}
```

**Filter structure:**

```json
{
  "customer": {
    "email": {
      "like": "%@acme.com",
      "caseInsensitive": true
    }
  }
}
```

| Budget | Value |
| ------ | ----- |
| **Depth** | `1` — M:1 association navigation on `OrderFilter` |
| **Nodes** | `2` — `customer` association node + `email.like` leaf |
| **Translation** | **`INNER JOIN`** to `customer` on `order.customer_id = customer.id` (or `EXISTS` equivalent) with parameterized `ILIKE` |

M:1 filters use **direct nested `<RelatedEntity>Filter`** — not `AssociationFilter`. Equivalent FK-scalar form: `{ customerId: { in: [ … ] } }` after a separate lookup; nested form keeps a single round-trip.

---

##### Example 5 — nested `AND` / `OR` with association

**Intent:** Return **active** orders for **VIP customers** **or** orders with **total > 10000**.

```graphql
query ActiveVipOrHighValue {
  listOrder(
    filter: {
      AND: [
        { status: { eq: ACTIVE } }
        {
          OR: [
            { customer: { tier: { eq: VIP } } }
            { total: { gt: 10000 } }
          ]
        }
      ]
    }
  ) {
    id
    status
    total
    customer { name tier }
  }
}
```

**Filter structure:**

```json
{
  "AND": [
    { "status": { "eq": "ACTIVE" } },
    {
      "OR": [
        { "customer": { "tier": { "eq": "VIP" } } },
        { "total": { "gt": 10000 } }
      ]
    }
  ]
}
```

| Budget | Value |
| ------ | ----- |
| **Depth** | `3` — root `AND` (1) → nested `OR` (2) → `customer` association in OR branch (3) — **exceeds default `filterMaxDepth: 2`** |
| **Nodes** | `5` — `AND`, `OR`, `status.eq`, `customer` + `tier.eq`, `total.gt` |
| **Translation** | Root entity `WHERE` with `status = 'ACTIVE' AND (customer.tier = 'VIP' OR total > 10000)` — `customer` branch uses join/`EXISTS` on `customer` via `customer_id` |

Raise limits before using in production: `filterMaxDepth: 3` in `dal/dal.config.yaml` or `DAL_FILTER_MAX_DEPTH=3` (§10.7).

---

##### Example 6 — M:N through join table (`some`)

**Intent:** Return **courses** that have **at least one enrolled student** whose name contains `Smith`. (M:N modeled per §2.7 — join entity `CourseEnrollment` with `courseId` + `studentId`.)

```graphql
query CoursesWithSmithStudent {
  listCourse(
    filter: {
      students: {
        some: {
          name: { like: "%Smith%", caseInsensitive: true }
        }
      }
    }
  ) {
    id
    title
  }
}
```

**Filter structure:**

```json
{
  "students": {
    "some": {
      "name": {
        "like": "%Smith%",
        "caseInsensitive": true
      }
    }
  }
}
```

| Budget | Value |
| ------ | ----- |
| **Depth** | `1` — `students` → `some` |
| **Nodes** | `2` — `students.some` + `name.like` leaf |
| **Translation** | **`EXISTS` subquery** on join table `course_enrollment` linking `course.id` to `student.id`, with join to `student` for the name predicate (§10.6) |

Index join-table **owner columns** (`course_id`, `student_id`) for filter performance (§2.8, §17.1 planned v2).

---

##### Example 7 — ds-cli `--input-json` (complex filter)

**Intent:** Same filter as Example 5 — **ops/automation** path only. ds-cli and `@corpdk/ds-sdk` execute this as a GraphQL query against the same API (§2.12); production UI code should call GraphQL HTTP/WS directly. ds-cli accepts the full filter tree via JSON (Appendix A).

```bash
ds-cli listOrder --input-json '{
  "filter": {
    "AND": [
      { "status": { "eq": "ACTIVE" } },
      {
        "OR": [
          { "customer": { "tier": { "eq": "VIP" } } },
          { "total": { "gt": 10000 } }
        ]
      }
    ]
  },
  "sort": [{ "field": "CREATED_AT", "direction": "DESC" }]
}'
```

| Note | Detail |
| ---- | ------ |
| **Wire format** | Enum values as **strings** (`"ACTIVE"`, `"VIP"`) in JSON — GraphQL parse normalizes to enum members (§10.5) |
| **Depth guard** | Requires `filterMaxDepth ≥ 3` (Example 5) |
| **Alternatives** | `--input-file orders-filter.json` for large trees; see [Appendix A — ds-cli Conventions](#appendix-a--ds-cli-conventions) |
| **SDK** | `@corpdk/ds-sdk` TypedDocumentNode calls avoid shell-escaping — still GraphQL under the hood; ops/automation only, not a primary app runtime path |

---

### 10.7 Filter complexity limits

To prevent abusive filter parse trees, the DAL enforces configurable depth and node budgets at **filter parse time** — before the FilterAST is passed to QueryTranslator. Limits apply to all filter-bearing operations: `list<Entity>`, `list<Entity>Connection`, `count<Entity>`, `aggregate<Entity>`, and filter-based bulk mutations.

| Limit | Config key | Default | Env override |
| ----- | ---------- | ------- | ------------ |
| **maxDepth** | `filterMaxDepth` | `2` | `DAL_FILTER_MAX_DEPTH` |
| **maxNodes** | `filterMaxNodes` | `50` | `DAL_FILTER_MAX_NODES` |

#### Configuration

| Surface | Rule |
| ------- | ---- |
| **Primary** | `dal/dal.config.yaml` workspace config (§6.5) |
| **Override** | Optional environment variables take **precedence** over config-file values when set |
| **Fallback** | When a key is omitted from config **and** its env var is unset, the **default** in the table above applies |
| **Validation** | Values must be positive integers; invalid config fails at **DAL startup** (not per-request) |

Defaults (`2`, `50`) are **config defaults**, not hardcoded constants without an override path — deployers may raise or lower limits via config file or env.

**Depth** counts nested logical operators (`AND` / `OR` / `NOT`) and association filter levels (`some` / `every` / `none`). **Nodes** — each leaf scalar predicate and each association filter node counts toward `filterMaxNodes`.

#### Exceeded limits

When either limit is exceeded, the request fails with a **validation error** (`BAD_USER_INPUT`) **before query translation** — no SQL is generated or executed.

#### Who configures

Configured by the **workspace administrator or deployer** via `dal/dal.config.yaml` and/or deployment environment variables. Not client-configurable.

#### Relationship to `strict`

**Not affected by `strict: true`:** `strict` is a **codegen-time** index and comment enforcement flag (§17.1). Filter complexity limits are **runtime** query guards and are independent of `strict` mode.

---

## 11. Sorting

Sort configuration is **entity-specific** — each PersistedEntity gets its own **`<Entity>SortInput`** (e.g. `ItemSortInput`, `OrderSortInput`) because the `field` argument references that entity's **`<Entity>Field`** enum. There is no shared `SortInput`. **`SortDirection`** remains a single global enum.

```graphql
input <Entity>SortInput {
  field: <Entity>Field!
  direction: SortDirection!
}

enum <Entity>Field {
  FIELD_A
  FIELD_B
  FIELD_C
}

enum SortDirection {
  ASC
  DESC
}
```

Example for `Item`:

```graphql
input ItemSortInput {
  field: ItemField!
  direction: SortDirection!
}
```

### Rules

* Codegen emits **`<Entity>SortInput`** per PersistedEntity — used on `list<Entity>`, `list<Entity>Connection` (`sort` arg), and echoed in `PaginationRequestInfo.sort` (§12.3).
* Sort fields are a **whitelist enum** (`<Entity>Field`) generated from **all scalar columns** inferred from Drizzle ([PostgreSQL type coverage](dal-pg-type-mapping.md#postgresql-type-coverage)).
* When **`sort` is omitted**, default is **`[{ field: ID, direction: ASC }]`** — primary key ascending.
* System enforces deterministic ordering with **`id` as tie-breaker** on the final sort key (appended after client-provided sort keys when `id` is not already the last key).
* Changes to the sort enum bump the entity's **cursor codec version** (§13.2), invalidating existing cursors.

---

## 12. Pagination

### 12.0 Relay conformance

Connection SDL shapes follow the [Relay GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm). Execution semantics in §12.4–§12.5 map Relay's in-memory `ApplyCursorsToEdges` / `EdgesToReturn` algorithms to **SQL keyset predicates** — functionally equivalent, but evaluated in the database rather than over a materialized edge list.

#### Reserved types

Codegen **must** emit:

* A single global **`PageInfo`** type (shared across all entities).
* Per-entity **`<Entity>Connection`** and **`<Entity>Edge`** types (names ending in `Connection` / `Edge`).

These names are reserved per Relay §1.

#### Intentional deviations

| Deviation | Relay spec | This spec |
| --------- | ---------- | --------- |
| **`nodes` convenience field** | Additional connection fields allowed | Exposed on every `<Entity>Connection` for direct node access without mapping `edges` |
| **`first` + `last` together** | Strongly discouraged | **Forbidden** — validation error |
| **Default / max page size** | Not specified | Default **`first: 100`**; max **`1000`** for `first` / `last` |
| **`sort` on connection field** | Not specified | **`sort: [<Entity>SortInput!]`** top-level on connection field (§11); bound into cursor payload |
| **`PageInfo.request` echo** | Not specified | **`request: PaginationRequestInfo`** echoes resolved connection field args (§12.3) |
| **`totalCount` on Connection** | Not forbidden | **Omitted** — use `count<Entity>` separately (§15.6) |
| **Cursor contents** | Agnostic (opaque to client) | **Keyset JSON payload**, Base64url-encoded, with optional **HMAC-SHA256** signing (§13) |
| **Unknown / invalid cursor** | `ApplyCursorsToEdges` no-op when cursor not found | **`BAD_USER_INPUT`** — stricter than Relay's silent skip |

---

### 12.1 Connection field arguments

Relay-compliant pagination and sort arguments are declared **directly on** `list<Entity>Connection` (§8.2) — not nested in an input object.

| Argument | Type | Role |
| -------- | ---- | ---- |
| **`sort`** | `[<Entity>SortInput!]` | Entity-specific sort keys (§11); bound into cursor payload |
| **`first`** | `Int` | Forward page size |
| **`after`** | `String` | Forward cursor |
| **`last`** | `Int` | Backward page size |
| **`before`** | `String` | Backward cursor |

**Validation rules** (see also §8.2):

* **`first < 0`** or **`last < 0`** → validation error (Relay: throw on negative slice).
* Max **`first`** / **`last`**: **`1000`** — values above max return a **validation error** (reject; do not clamp).
* **`first: 0`** or **`last: 0`** → valid empty page (`edges` / `nodes` empty; `pageInfo` populated).
* **`first` + `last` together** → validation error (Relay strongly discourages; we forbid).

**Allowed argument combinations:**

| Combination | Status | Notes |
| ----------- | ------ | ----- |
| **`after` + `before`** | **Allowed** | Bounded window paging — Relay-allowed; both cursors applied before slicing (§12.4) |
| **`first` + `last`** | **Forbidden** | Validation error |
| Only **`after`** (no `first` / `last`) | Allowed | Default **`first: 100`** |
| Only **`before`** (no `first` / `last`) | Allowed | Recommend default **`last: 100`** |
| Neither **`first`** nor **`last`** | Allowed | Default **`first: 100`** |

---

### 12.2 PageInfo

```graphql
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
  request: PaginationRequestInfo
}
```

**`hasNextPage` / `hasPreviousPage`** — keyset equivalents of Relay `HasNextPage` / `HasPreviousPage` (§12.4):

| Client paging mode | Required computation |
| ------------------ | -------------------- |
| **`first` set** | **`hasNextPage`** = after applying cursor filters and fetching one more row than `first`, additional matching rows exist beyond the returned slice. When **`first: 0`**, **`hasNextPage`** reflects whether any rows match after cursor filters (typically `false` when the slice is empty). |
| **`last` set** | **`hasPreviousPage`** = after applying cursor filters and fetching one more row than `last`, additional matching rows exist before the returned slice. When **`last: 0`**, **`hasPreviousPage`** reflects whether any rows match before cursor filters (typically `false` when the slice is empty). |
| **`after` only** (no `first` / `last`; default `first: 100` applies) | **`hasNextPage`** as above; **`hasPreviousPage`** = `true` when rows exist before the `after` cursor (keyset can determine this efficiently). |
| **`before` only** (default `last: 100` recommended) | **`hasPreviousPage`** as above; **`hasNextPage`** = `true` when rows exist after the `before` cursor. |

Implementation: fetch **`limit + 1`** rows in the slice direction, return the first **`limit`** edges, and set the relevant `has*Page` flag from the extra row.

**`startCursor` / `endCursor`:**

* **`null`** when **`edges`** is empty.
* Otherwise **`startCursor`** = cursor of the **first** edge in `edges`; **`endCursor`** = cursor of the **last** edge in `edges` (Relay §5.1).

---

### 12.3 Request echo

`PageInfo.request` echoes the **resolved** connection field arguments after defaults are applied — flat `first`, `after`, `last`, `before`, and `sort` (not a nested pagination object).

```graphql
type PaginationRequestInfo {
  first: Int
  after: String

  last: Int
  before: String

  sort: [<Entity>SortInput!]
}
```

---

### 12.4 Pagination execution semantics

Relay defines pagination over an in-memory edge list (`ApplyCursorsToEdges` → `first` slice → `last` slice). The QueryEngine implements the **same ordering of steps** against SQL using keyset seek predicates.

**Algorithm (keyset equivalent of Relay `EdgesToReturn`):**

1. **Resolve sort** — use connection field `sort` or default `[{ field: ID, direction: ASC }]` (§11); append **`id` tie-breaker** when not already the final key.
2. **Apply cursors** (Relay `ApplyCursorsToEdges`) — translate `after` / `before` into keyset `WHERE` predicates:
   * **`after`**: exclude rows at or before the cursor position; the row **closest to the cursor** (if any) becomes the **first** edge in the result (§12.5).
   * **`before`**: exclude rows at or after the cursor position; the row **closest to the cursor** (if any) becomes the **last** edge in the result (§12.5).
3. **Apply `first`** — when set, keep at most **`first`** rows from the start of the filtered set (after fetching **`first + 1`** for `hasNextPage`).
4. **Apply `last`** — when set, keep at most **`last`** rows from the end of the filtered set (after fetching **`last + 1`** for `hasPreviousPage`). Step 4 runs only when **`last`** is set; **`first` + `last` together** is forbidden (§12.1).

**Validation and error semantics:**

| Condition | Result |
| --------- | ------ |
| **`first < 0`** or **`last < 0`** | Validation error |
| **`first: 0`** or **`last: 0`** | Valid empty page |
| Malformed cursor (decode failure, bad signature, version mismatch) | **`BAD_USER_INPUT`** |
| Valid cursor but **no visible row** at cursor position (deleted row, filter mismatch, sort contract drift) | **`BAD_USER_INPUT`** — treat as stale; client must restart from first page |
| Unknown cursor (Relay: no-op) | **`BAD_USER_INPUT`** — stricter than Relay |

Relay's reference `ApplyCursorsToEdges` silently ignores cursors that do not match an edge in the current result set. This spec **rejects** such cursors because keyset SQL cannot reliably distinguish "cursor not found" from "row deleted" without an extra lookup — and a failed lookup indicates stale pagination state.

---

### 12.5 Edge ordering invariants

Per Relay §4.3, edge order must be **consistent across pages** and **must not reverse** when switching between forward (`first` / `after`) and backward (`last` / `before`) paging.

| Rule | Requirement |
| ---- | ----------- |
| **Stable global order** | Same sort order for every page of the same query (sort keys + `id` tie-breaker; §11). |
| **Forward / backward consistency** | Order when using `last` / `before` is **identical** to order when using `first` / `after` — **not reversed**. |
| **`after: cursor`** | Edge **closest to `cursor`** appears **first** in `edges`. |
| **`before: cursor`** | Edge **closest to `cursor`** appears **last** in `edges`. |
| **Default sort** | When `sort` is omitted: **`[{ field: ID, direction: ASC }]`** (§11). |
| **Tie-breaker** | **`id`** appended as final sort key when not already last (§11). |

Cursors encode the active sort keys and keyset values so that seek predicates preserve this ordering across requests.

---

## 13. Cursor Design

Cursors are **opaque**, server-decoded keyset pagination tokens. They are **deterministic and stable** across requests with identical sort.

### 13.1 Payload schema

Each cursor encodes a JSON payload with these fields:

| Field | Type | Description |
| ----- | ---- | ----------- |
| **`version`** | `Int` | **Cursor codec version** for this entity's pagination contract (§13.2) |
| **`entity`** | `String` | Entity name (prevents cross-entity cursor reuse) |
| **`sort`** | `[{ field, direction }]` | Sort keys and directions active when the cursor was issued (mirrors resolved **`<Entity>SortInput`** entries) |
| **`values`** | `[Scalar]` | Keyset values aligned 1:1 with `sort` entries (plus implicit `id` tie-breaker value); typed per [PG → DAL mapping](dal-pg-type-mapping.md#pg-dal-type-mapping) — `ID`, `DateTime`, `Date`, `TimeTz`, `BigInt`, `Decimal`, `IntervalMs`, `String`, `Int`, `Float`, `Boolean`, opt-in custom scalars, or enum string |
| **`includeDeleted`** | `Boolean` | Whether soft-deleted rows were included in the originating query |

The payload is **Base64url-encoded**. When signing is enabled (§13.3), the wire format is **`{base64urlPayload}.{signature}`**.

### 13.2 Version semantics and stale cursor rejection

* **`version`** is the **cursor codec version** for that entity's pagination contract — **not** app, npm, or database version.
* Codegen emits a per-entity version constant; it is **bumped by codegen** when any of the following change: sort enum membership, tie-breaker rules, `includeDeleted` semantics, or payload shape.
* **No time-based TTL** — cursors remain valid indefinitely as long as the codec version and sort contract are unchanged.
* A cursor is **rejected** (validation error) when:
  * **`version` mismatches** the current codec version for that entity, **or**
  * **Any encoded sort field is absent** from the current `<Entity>Field` enum (Drizzle schema / sort contract changed).
* Sort enum changes constitute a **breaking cursor migration** — clients must restart pagination from the first page.

### 13.3 Signing (optional)

| Concern | Rule |
| ------- | ---- |
| **Algorithm** | **HMAC-SHA256** over the Base64url payload |
| **Wire format** | `{base64urlPayload}.{signature}` where `signature` is Base64url-encoded HMAC digest |
| **Activation** | Signing is **enabled when `DAL_CURSOR_SECRET` env var is set**; unsigned cursors are allowed in local dev only |
| **Invalid signature** | Returns **`BAD_USER_INPUT` GraphQL error** — no fallback unsigned decode |

When signing is disabled (local dev), cursors are Base64url-encoded payload only (no `.` suffix).

### 13.4 Decode rules

* Decoded **only server-side** — clients treat cursors as opaque strings.
* Decode validates signature (when enabled), version, entity name, and sort field membership before executing keyset pagination.
* Cursor values are bound as parameterized query values via Drizzle — never interpolated into SQL.

### 13.5 Cursor migration runbook (deploy-and-reject)

When Drizzle schema changes invalidate existing cursors (sort enum membership, tie-breaker rules, payload shape — §13.2), the system uses a **deploy-and-reject** strategy. There is **no dual-decode window** and no grace period for stale cursor formats.

**Runbook:**

1. **Drizzle schema sort change** → rerun codegen; codegen **bumps `CURSOR_CODEC_VERSION`** for affected entities.
2. **Changelog** — document **"Breaking: pagination"** per affected entity; notify API consumers.
3. **Deploy** — after deploy, stale cursors decode to **`BAD_USER_INPUT`** with a clear message (version mismatch or unknown sort field). Clients must **discard stored cursors** and restart pagination from the first page.
4. **Optional post-deploy metric** — track cursor rejection rate to confirm clients have migrated.

Do not attempt to decode cursors against prior codec versions at runtime.

---

## 14. Subscriptions

### 14.1 Unified `<entity>Changed`

One subscription per entity replaces per-operation subscriptions:

```graphql
type Subscription {
  itemChanged(subscribeTo: [ChangeOperation!]): ItemChangeEvent!
}

enum ChangeOperation {
  CREATED
  UPDATED
  DELETED
}
```

* **`subscribeTo`** filters which operations the client receives. When omitted, all **applicable** operations are delivered.
* Bulk and single mutations emit the **same event type**.
* On **`append-only`** entities (§2.3), only **`CREATED`** and **`DELETED`** are emitted — **`UPDATED`** is never published because update mutations do not exist. Clients may still pass `UPDATED` in `subscribeTo`; it simply never matches an event for that entity.

---

### 14.2 EntityChangeEvent payload (IDs only)

```graphql
type ItemChangeEvent {
  operation: ChangeOperation!
  ids: [ID!]!
  truncated: Boolean!
  count: Int!
}
```

| Condition | Payload |
| --------- | ------- |
| Affected IDs **≤ 100** | `{ operation, ids: [...], truncated: false, count: N }` |
| Affected IDs **> 100** | `{ operation, ids: [], truncated: true, count: N }` |

Clients refetch affected records via `get<Entity>ById` or `list<Entity>` with an `id in` filter when truncation occurs.

### 14.3 Delivery guarantees

| Concern | Guarantee |
| ------- | --------- |
| **Publish timing** | Events are published **after** the write transaction **commits** — subscribers never observe uncommitted data |
| **Delivery model** | **Best-effort, at-most-once** — no replay buffer, no gap recovery |
| **Ordering** | **No cross-client ordering guarantee** — events may arrive out of order relative to other clients |
| **Multi-instance** | **Redis pubsub required** when running multiple DS instances; still **no durability** — a disconnect means missed events |
| **Client contract** | Subscriptions are **signals**, not an audit log — clients **refetch** affected records on reconnect or when `truncated: true` |

### 14.4 Event scope

| Rule | Detail |
| ---- | ------ |
| **Emitting entity** | Only the **directly mutated PersistedEntity** emits `<entity>Changed` |
| **No cascade** | FK changes on related entities do **not** emit events on those related entities |
| **Bulk mutations** | **One `<entity>Changed` event per mutation call** — not one event per row (payload carries all affected IDs up to truncation limit) |
| **Soft delete** | Emits **`DELETED`** (same as hard delete from the client's perspective) |
| **Append-only** | Emits **`CREATED`** and **`DELETED`** only — **`UPDATED`** never applies (§14.1) |
| **Payload** | IDs only — never full entity objects |

---

## 15. Aggregation System (Strongly Typed)

### 15.1 Numeric field selection

Codegen emits `<Entity>NumericFields` from Drizzle numeric scalars suitable for **`sum`** / **`avg`** ([PG → DAL mapping](dal-pg-type-mapping.md#pg-dal-type-mapping)):

| Included PG types | GraphQL scalar | Aggregate result type in `NumericResult` |
| ----------------- | -------------- | ------------------------------------------ |
| `smallint`, `integer` | `Int` | `Float` (SQL aggregate returns float/double) |
| `bigint` | `BigInt` | `Decimal` (string on wire — preserves large sums) |
| `numeric`, `decimal` | `Decimal` | `Decimal` |
| `real`, `double precision` | `Float` | `Float` |

```graphql
input <Entity>NumericFields {
  quantity: Boolean      # Int column
  totalCents: Boolean    # BigInt column
  unitPrice: Boolean     # Decimal column
  weight: Boolean        # Float column
}
```

Only numeric columns inferred from Drizzle appear in this type.

---

### 15.2 Comparable field selection

Codegen emits `<Entity>ComparableFields` from Drizzle scalars where **min/max are meaningful** ([PG → DAL mapping](dal-pg-type-mapping.md#pg-dal-type-mapping)):

| Included | Excluded |
| -------- | -------- |
| **Int**, **BigInt**, **Decimal**, **Float** (all numeric PG types) | **Boolean** |
| **DateTime** (`timestamptz`) | **Enum** |
| **TimeTz** (`timetz`) | Associations |
| **Date** (`date`) | |
| **IntervalMs** (`interval`) | |
| **String**, **ID** (`uuid` columns) | Unsupported types (JSON, binary, arrays, range, etc.) |

**Nullability does not exclude a field** — nullable columns may appear in ComparableFields.

```graphql
input <Entity>ComparableFields {
  name: Boolean          # String
  effectiveDate: Boolean # Date
  createdAt: Boolean     # DateTime
  opensAt: Boolean       # TimeTz
  customerId: Boolean    # ID (uuid column)
  quantity: Boolean      # Int
  balance: Boolean       # BigInt / Decimal
}
```

---

### 15.3 Aggregate input

```graphql
input <Entity>AggregateInput {
  count: Boolean

  sum: <Entity>NumericFields
  avg: <Entity>NumericFields
  min: <Entity>ComparableFields
  max: <Entity>ComparableFields
}
```

**Validation:** input must include **≥ 1 aggregate flag** (`count: true` and/or at least one field set to `true` in `sum`, `avg`, `min`, or `max`). An empty input returns a validation error.

---

### 15.4 Aggregate result (strongly typed)

Top-level keys for **unrequested** aggregates are **`null`** in the result object.

Per-field values inside `NumericResult` / `ComparableResult` are **nullable** (not `!`).

```graphql
type <Entity>AggregateResult {
  count: Int

  sum: <Entity>NumericResult
  avg: <Entity>NumericResult
  min: <Entity>ComparableResult
  max: <Entity>ComparableResult
}

type <Entity>NumericResult {
  quantity: Float       # Int column aggregate
  totalCents: Decimal   # BigInt column aggregate
  unitPrice: Decimal    # Decimal column aggregate
  weight: Float         # Float column aggregate
}

type <Entity>ComparableResult {
  quantity: Int         # Int min/max
  balance: BigInt       # BigInt min/max
  unitPrice: Decimal    # Decimal min/max
  weight: Float         # Float min/max
  name: String          # String min/max
  customerId: ID        # ID (uuid column) min/max
  effectiveDate: Date   # Date min/max
  createdAt: DateTime   # DateTime min/max — ISO-8601 UTC with milliseconds
  opensAt: TimeTz       # TimeTz min/max — ISO-8601 time with offset
}
```

Result field types match the underlying GraphQL scalar per [PG → DAL mapping](dal-pg-type-mapping.md#pg-dal-type-mapping): `Int` → `Int` (min/max) or `Float` (sum/avg); `BigInt` → `BigInt` (min/max) or `Decimal` (sum/avg); `Decimal` → `Decimal`; `Float` → `Float`; `String` → `String`; `ID` → `ID` (uuid columns); `Date` → `Date`; `DateTime` → `DateTime`; `TimeTz` → `TimeTz`; `IntervalMs` → `IntervalMs`.

---

### 15.5 Nullable semantics (SQL-aligned)

| Aggregate | Empty set (zero matching rows) | All-null group |
| --------- | ------------------------------ | -------------- |
| **`count`** (when requested) | **`0`** | **`0`** |
| **`sum`** / **`avg`** | **`null`** (top-level and per-field) | **`null`** |
| **`min`** / **`max`** | **`null`** (top-level and per-field) | **`null`** |

Unrequested top-level keys (`sum`, `avg`, `min`, `max`, `count`) are **`null`** in the result — not omitted.

---

### 15.6 Aggregate query and count sugar

```graphql
aggregate<Entity>(
  filter: <EntityFilter>
  input: <Entity>AggregateInput!
  includeDeleted: Boolean
): <Entity>AggregateResult!

count<Entity>(
  filter: <EntityFilter>
  includeDeleted: Boolean
): Int!
```

**`count<Entity>` is mandatory sugar** for `aggregate(input: { count: true })`:

| Concern | Rule |
| ------- | ---- |
| **Semantics** | Identical filter and `includeDeleted` behavior; same **QueryEngine** path |
| **`count<Entity>` return type** | **`Int!`** — zero matching rows → **`0`** |
| **`aggregate.count` return type** | Nullable **`Int`** in the composite result per §15.5 (requested `count` on empty set → **`0`**; unrequested → **`null`**) |

---

### 15.7 Rules

* **`sum`** and **`avg`** operate only on numeric fields (via `<Entity>NumericFields`).
* **`min`** and **`max`** operate on comparable fields (via `<Entity>ComparableFields`).
* Fields are explicitly selected via boolean flags — no arbitrary column names.
* Aggregation reuses the same FilterAST → QueryTranslator pipeline as list queries.

---

## 16. Query Translation Layer

The **Query Translation Layer** replaces direct SQL generation. Responsibilities:

| Concern | Translation |
| ------- | ----------- |
| Filter | FilterAST → Drizzle `.where()` |
| Sort | `<Entity>SortInput` → Drizzle `.orderBy()` |
| Cursor | Opaque cursor → keyset (seek) pagination |
| ColumnProjection | GraphQL selection set → limited column SELECT (§17.2) |
| Aggregation | AggregateInput → Drizzle aggregate functions |
| Associations | AssociationFilter → Drizzle joins / subqueries / EXISTS on join tables |

### Shared pipeline

The same FilterAST and QueryTranslator power:

* `list<Entity>` / `list<Entity>Connection`
* `count<Entity>`
* `aggregate<Entity>`
* Filter-based bulk mutations (match count + update/delete)

There is **no raw SQL string API** exposed to resolvers or clients. Drizzle generates parameterized SQL at execution time.

---

## 17. Performance Requirements

* **Keyset pagination only** — no OFFSET-based paging
* **Indexed sort fields** — Drizzle-declared indexes; codegen validates sort field index coverage at codegen time (§17.1)
* **Lazy aggregation** — aggregate functions run only when requested in `AggregateInput`
* **ColumnProjection** — GraphQL field selection limits scalar columns fetched on list/get (§17.2)
* **Filter complexity caps** — configurable `filterMaxDepth` / `filterMaxNodes` in `dal/dal.config.yaml` (optional env overrides — §10.7); defaults prevent runaway parse trees at filter parse time

### 17.1 Index enforcement (codegen-time)

Index validation runs **at codegen time only** — not at query runtime. Indexes are read from Drizzle schema definitions.

| Mode | Behavior |
| ---- | -------- |
| **Default** | **Warn** when the primary sort column (first client-provided sort key, or `id` when no sort is given) lacks a covering index in Drizzle |
| **`strict: true`** in `dal/dal.config.yaml` | **Fail codegen** (non-zero exit) if any whitelisted sort field (**except `id`**) lacks a covering index declared in Drizzle; also fails on missing table/column comments (§2.11) |

**Multi-sort rules:** when the client provides multiple sort keys, a composite index must cover the sort **prefix through the last client-provided key**. The implicit **`id` tie-breaker** is assumed indexed (primary key) and is not validated separately.

**Out of scope for v1:** filter-field index enforcement — only sort-field coverage is checked (see planned v2 below).

**Planned v2 — filter-field index enforcement (codegen gate only, no runtime enforcement):**

| Mode | Behavior |
| ---- | -------- |
| **Default** | **Warn** when a filterable scalar field lacks a covering index declared in Drizzle |
| **`strict: true`** | Extends to filter fields — **fail codegen** when any filterable scalar (and association filter columns) lacks a covering index |

Association filters: indexes must cover **join-table owner columns** (many-to-many) and **M:1 FK columns** used in association filter translation. This is a codegen-time gate only — queries are not blocked at runtime in v2.

### 17.2 ColumnProjection (field-level selection)

**QueryEngine** derives a **ColumnProjection** from the GraphQL selection set for each entity fetch. This limits SQL column reads without affecting association navigation.

| Category | Columns | Rule |
| -------- | ------- | ---- |
| **Always fetched** | `id`; soft-delete columns (`deletedAt`, `deletedBy`) when entity uses soft delete | Included in every SELECT regardless of client selection |
| **Fetched when selected** | Business scalars; audit columns (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`) | Included only when the corresponding GraphQL field appears in the selection set |
| **Never via projection** | **AssociationField** navigation fields | Resolved separately via per-request DataLoader (§6.6) — not part of the root entity SELECT |

**Applies to:** `list<Entity>`, `list<Entity>Connection` (node fields), and `get<Entity>ById`.

**Does not apply to:** `count<Entity>`, `aggregate<Entity>` — these operations ignore field selection and operate on filter/match semantics only.

**Does not apply to:** **`bulkCreate` / `bulkUpdate` success payloads** — mutation responses always return full entity rows (§9.6).

FK scalar columns on output types (many-to-one) **are** subject to ColumnProjection — if the client omits `customerId` from the selection set, that column is not fetched.

---

## 18. Security Requirements

* **Strong typing** — no JSON filter blobs or untyped inputs
* **Field whitelisting** — filter, sort, and aggregate fields are enum-constrained from inferred Drizzle columns
* **Parameterized queries** — all values bound via Drizzle; no string interpolation
* **Actor trust boundary** — `createdBy`, `updatedBy`, `deletedBy` never from client input
* **Bulk safety** — empty-filter guard, matched-row cap, and `confirmDeleteAll` for filter-based ops (§9.7)
* **Optional cursor signing** — HMAC-SHA256 when `DAL_CURSOR_SECRET` is set; invalid signature → `BAD_USER_INPUT` (§13.3)
* **Filter complexity limits** — configurable `filterMaxDepth` / `filterMaxNodes` (config file + optional env overrides) enforced at parse time before query translation; independent of codegen **`strict`** mode (§10.7)
* **Bulk error messages** — `BulkOperationError.message` is always safe for clients; raw SQL and driver internals never exposed (Appendix B)

---

## 19. Extensibility

* **New entities** — add a Drizzle table with UUID `id`; rerun codegen; no DAL redesign
* **Custom repository methods** — override generated defaults via the subclass pattern (below)
* **Filter and aggregate extensions** — new scalar types or operators added to dal-core + codegen templates
* **Actor resolution** — plug in via Yoga `resolveActor(context)` without changing generated resolvers
* **Drizzle dialects** — new SQL databases supported when Drizzle adds dialect support; QueryTranslator adapts to dialect-specific operators only where Drizzle exposes them

Extensibility is scoped to the **Drizzle + GraphQL Yoga + SQL** stack documented in this spec. Multi-backend translator plugins for non-SQL stores are out of scope.

### 19.1 Repository override contract

Codegen emits a three-layer repository hierarchy per entity:

```
BaseOrderRepository          ← dal-core: sealed pipeline (FilterAST, QueryTranslator, cursors, bulk guards, actor columns)
  └── GeneratedOrderRepository   ← codegen: default CRUD + list + bulk implementations
        └── OrderRepository      ← consumer: optional overrides
```

**Overridable methods** (each generated stub calls `super.*` by default):

* `create`, `update`, `delete`, `findById` — **`update` and bulk update methods are not generated** for **`append-only`** entities (§7.3)
* `list`, `listConnection`, `count`, `aggregate`
* Bulk variants: `bulkCreate`, `bulkUpdate`, `bulkDelete`, `bulkUpdateByFilter`, `bulkDeleteByFilter` — update variants omitted for **`append-only`**

**Sealed (non-overridable)** — implemented in `Base<Entity>Repository` or private helpers; consumers must not bypass:

* FilterAST parsing and validation
* QueryTranslator wiring and SQL generation
* Cursor encode/decode and codec version checks (§13)
* Filter-based bulk safety guards (§9.7)
* Actor column population (§5)

**Canonical override example:**

```typescript
// src/repositories/order.repository.ts — consumer-owned
import { GeneratedOrderRepository } from '../generated/dal/repositories/generated-order.repository.js';

export class OrderRepository extends GeneratedOrderRepository {
  override async create(input: OrderCreateInput, ctx: RepositoryContext) {
    // Pre-write business rule — e.g. reject archived customers
    await this.assertCustomerActive(input.customerId, ctx);
    return super.create(input, ctx);
  }

  override async update(id: string, input: OrderUpdateInput, ctx: RepositoryContext) {
    const existing = await super.findById(id, ctx);
    if (existing?.status === 'ARCHIVED') {
      throw new ValidationError('Cannot update archived order');
    }
    return super.update(id, input, ctx);
  }
}
```

Resolvers and GraphQL Yoga wiring inject the consumer's `OrderRepository` instance; generated resolvers never reference Drizzle directly (§6.2).

---

## 20. Final Outcome

This system provides:

* **GraphQL-only application access** — the sole application-facing data surface; SDK and ds-cli are GraphQL client conveniences for ops/automation (§2.12)
* A **Drizzle-first, fully typed GraphQL query engine**
* Zero SQL or repository exposure to application clients; resolvers use repositories server-internally only (§6.2)
* High-performance keyset pagination with deterministic sort
* Strongly typed aggregation
* Unified `<entity>Changed` subscription with safe ID payloads and post-commit, best-effort delivery
* GraphQL **`ID`** for all `uuid` columns (PKs, FKs, filters, cursors, subscription payloads) — RFC 4122 validated at repository layer ([UUID → ID tradeoffs](dal-pg-type-mapping.md#uuid--id-tradeoffs))
* Custom **`DateTime`**, **`Date`**, **`TimeTz`**, **`BigInt`**, **`Decimal`**, and **`IntervalMs`** scalars with strict parse/serialize rules ([custom DAL scalars registry](dal-pg-type-mapping.md#custom-dal-scalars-registry), §3.1); opt-in scalars for rare network/geometric/PostGIS types
* Mandatory per-request **DataLoader** for **all** association navigation fields
* **ColumnProjection** field-level selection on list/get queries
* Configurable bulk atomicity with filter-based safety guards
* Inferred audit profiles (**`full`**, **`append-only`**) — required on every entity; invalid combinations fail codegen — and soft delete from Drizzle column presence
* A reusable **dal-core + codegen-cli** architecture for Drizzle-backed services
* Committed **`src/generated/dal/`** output via `pnpm dal:codegen` for reviewable, idempotent regen — including GraphQL SDL with **`"""…"""` descriptions** auto-generated from Drizzle DB object comments (§2.11)
* Mandatory **`count<Entity>`** sugar alongside strongly typed **`aggregate<Entity>`**
* Tamper-evident cursor signing (HMAC-SHA256) when `DAL_CURSOR_SECRET` is configured
* **All scalar columns** filterable and sortable by default
* **All Drizzle relations** exposed on GraphQL with navigation fields and DataLoaders
* v1 field validation: nullability, enum membership, custom scalar parse (`DateTime`, `Date`, `TimeTz`, `BigInt`, `Decimal`, `IntervalMs`), `ID` validation for uuid columns — no length/range/regex constraints (§2.9)
* **Repository subclass override** contract with sealed pipeline internals (§19.1)
* **`READ COMMITTED`** transactions for atomic bulk and filter-based ops with row-level locks (§9.8)
* **`BulkOperationError` code taxonomy** with deterministic driver mapping (Appendix B)
* **Deploy-and-reject** cursor migration runbook — no dual-decode window (§13.5)
* Full entity rows on bulk create/update success paths — no ColumnProjection on mutations (§9.6, §17.2)

---

## Appendix A — ds-cli Conventions

The auto-generated **`ds-cli`** is an **ops/automation GraphQL client** — not an alternate data-access layer. Every command executes a GraphQL operation (query, mutation, or subscription) against the same HTTP/WS endpoint as application clients (§2.12). Production UI and service code should call GraphQL directly; ds-cli is for scripts, CI, and LLM automation workflows.

| Concern | Convention |
| ------- | ---------- |
| **Purpose** | Ops, automation, and scripting — **not** primary application runtime data access |
| **Transport** | GraphQL HTTP (and WS for subscriptions) — same API surface as Apollo/urql clients |
| **Nested / complex inputs** | **`--input-file <path>`** (JSON file) or **`--input-json '<json>'`** |
| **Union or complex outputs** | Raw JSON stdout — no automatic field selection |
| **Complex filters** | LLM/automation clients may prefer the **TypedDocumentNode SDK** (`@corpdk/ds-sdk` pattern) over shell escaping; both SDK and ds-cli remain GraphQL clients |

ds-cli does not attempt to flatten recursive filter inputs into flat CLI flags. For bulk mutations returning per-entity unions (§9), CLI output is the raw GraphQL response JSON.

**`@corpdk/ds-sdk`** follows the same rule: TypedDocumentNode helpers compile to GraphQL operations executed against the API. SDK is a type-safe GraphQL client convenience for automation — application runtime code uses GraphQL HTTP/WS directly.

### Scalar serialization via `--input-json`

`--input-json` passes values through in **wire format** — normalization happens at **GraphQL scalar parse** (§3.1), not in the CLI layer.

| Scalar | Wire format in JSON | Not accepted in v1 |
| ------ | ------------------- | -------------------- |
| **ID** (uuid columns) | Lowercase RFC 4122 string | Uppercase variants, brace-wrapped forms, non-string types |
| **DateTime** | ISO-8601 UTC with milliseconds | Unix timestamps (numeric or string), timezone-less local strings without offset |
| **TimeTz** | ISO-8601 time with offset — `"13:45:00.000+05:30"` or `"13:45:00Z"` | Date components, timezone-less local time without offset |
| **Date** | ISO-8601 date — `"2026-09-10"` | Datetime strings with time component, numeric epoch |
| **BigInt** | Decimal integer string — `"9223372036854775807"` | JSON numbers (must be string), scientific notation |
| **Decimal** | Decimal string — `"1234.56"` | JSON numbers (must be string), scientific notation |
| **IntervalMs** | Signed ms string — `"3600000"` | JSON numbers (must be string), fractional values |

**Examples:**

```bash
# ID (uuid column) — lowercase RFC 4122 string
ds-cli createOrder --input-json '{"customerId":"550e8400-e29b-41d4-a716-446655440000","status":"PENDING"}'

# DateTime — ISO-8601 UTC with milliseconds
ds-cli listOrder --input-json '{"filter":{"createdAt":{"gte":"2026-09-10T13:28:00.000Z"}}}'

# Date — ISO-8601 calendar date
ds-cli listEmployee --input-json '{"filter":{"birthDate":{"gte":"1990-01-01"}}}'

# BigInt / Decimal — string on wire
ds-cli createLedgerEntry --input-json '{"amount":"9999999999999","balance":"1234.56"}'

# Association + logical filter tree — see §10.6.1 Example 7 (requires filterMaxDepth ≥ 3)
ds-cli listOrder --input-file ./filters/active-vip-or-high-value.json
```

Invalid scalar strings fail at GraphQL parse with **`BAD_USER_INPUT`** — the CLI does not pre-validate or alias alternate formats.

For **association filters** (`some` / `every` / `none`), nested M:1 filters, and multi-level `AND` / `OR` trees, see **§10.6.1** — worked examples include FilterAST depth/node budgets and Drizzle translation notes.

---

## Appendix B — BulkOperationError code taxonomy

`BulkOperationError.code` is a **fixed string union in dal-core** for type safety in generated repositories and tests. The GraphQL schema exposes `code` as **`String`** (not a GraphQL enum) to allow forward-compatible additions without schema migrations.

### Canonical codes (v1)

| Code | When used |
| ---- | --------- |
| **`NOT_FOUND`** | Target row does not exist (or soft-deleted without `includeDeleted`) |
| **`VALIDATION_FAILED`** | Input or business-rule validation rejected the row |
| **`UNIQUE_VIOLATION`** | Unique index or constraint conflict on insert/update |
| **`FK_VIOLATION`** | Foreign key constraint violation |
| **`CONSTRAINT_VIOLATION`** | Other check/constraint failures not covered above |
| **`UNKNOWN`** | Unmapped driver error — safe generic message; never raw SQL |

### Mapping rules

* Drizzle/driver errors are mapped **deterministically** to the codes above based on error class / SQLSTATE (dialect-specific mappers in dal-core).
* **`message`** is always a **safe, client-facing string** — raw SQL, table names, and driver internals are **never** exposed.
* **`id`** — set to the affected row's **`ID`** (uuid PK) when the error maps to a specific entry in an ID-list bulk operation; **`null`** for filter-based bulk failures and aggregate validation errors.

Filter-based bulk mutations that fail entirely (cap exceeded, empty filter without confirm) return GraphQL errors at the operation level — not per-row `BulkOperationError` entries.

---

**Related:** [DAL Entity Design Guidelines](dal-entity-design.md) | [DAL PostgreSQL Type Reference](dal-pg-type-mapping.md) | [Developer Guides](README.md)

**Last updated:** September 11, 2026
