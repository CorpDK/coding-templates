# DAL PostgreSQL Type Reference

Reference for which **PostgreSQL column types** DAL codegen supports and how they map to **GraphQL scalars**, **filter inputs**, **sort fields**, and **aggregate selectors**.

PersistedEntity tables may use **only** column types marked **Supported** in the [PostgreSQL type coverage](#postgresql-type-coverage) tables below. All other PostgreSQL types **fail codegen** with an error naming the PG type and suggesting normalization (child table, Redis, object storage, etc.).

**Related:** [GraphQL DAL Requirements](graphql-dal-requirements.md) — inference rules, filters, pagination, and aggregate behavior | [DAL Entity Design Guidelines](dal-entity-design.md) — schema-author guidance for column types

---

## PostgreSQL type coverage

Comprehensive coverage for **PostgreSQL** (primary Drizzle dialect). Other SQL dialects follow the same DAL scalar mapping where Drizzle exposes an equivalent column builder.

### Numeric

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `smallint` | `smallint()` | Supported | `Int` | `IntFilter` | Yes | sum/avg/min/max | 16-bit; wire-safe within GraphQL `Int` |
| `integer` | `integer()` | Supported | `Int` | `IntFilter` | Yes | sum/avg/min/max | 32-bit max `2_147_483_647` |
| `bigint` | `bigint()` | Supported (custom scalar) | `BigInt` | `BigIntFilter` | Yes | sum/avg/min/max | String on wire — avoids `Int` overflow |
| `decimal` / `numeric` | `numeric()` / `decimal()` | Supported (custom scalar) | `Decimal` | `DecimalFilter` | Yes | sum/avg/min/max | String on wire — no Float precision loss |
| `real` | `real()` | Supported | `Float` | `FloatFilter` | Yes | sum/avg/min/max | IEEE single precision |
| `double precision` | `doublePrecision()` | Supported | `Float` | `FloatFilter` | Yes | sum/avg/min/max | IEEE double precision |
| `serial` | `serial()` | Not supported | — | — | — | — | Discouraged — use `uuid` PK; `serial` as business column fails codegen |
| `bigserial` | `bigserial()` | Not supported | — | — | — | — | Same as `serial` |
| `money` | `money()` | Not supported | — | — | — | — | **Hard ban** — entity validation and codegen **fail**; use `integer` cents or `numeric`/`decimal`; never PG `money` |

### Character

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `char(n)` | `char()` | Supported | `String` | `StringFilter` | Yes | min/max | Fixed-length; trailing spaces trimmed on read |
| `varchar(n)` | `varchar()` | Supported | `String` | `StringFilter` | Yes | min/max | |
| `text` | `text()` | Supported | `String` | `StringFilter` | Yes | min/max | Actor columns (`createdBy`, etc.) use `text` |
| `citext` | custom / extension | Supported | `String` | `StringFilter` | Yes | min/max | Case-insensitive storage; filter uses `caseInsensitive: true` |
| `name` | `name()` (internal) | Not supported | — | — | — | — | PostgreSQL catalog type — not for entity columns |

### Boolean

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `boolean` | `boolean()` | Supported | `Boolean` | `BooleanFilter` | Yes | — | Excluded from `ComparableFields` ([§15.2](graphql-dal-requirements.md#152-comparable-field-selection)) |

### Date / time

**Only timezone-aware time types are allowed:** `timestamptz` and `timetz`. Plain `timestamp` and plain `time` are **hard-banned** — validation fails.

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `date` | `date()` | Supported (custom scalar) | `Date` | `DateFilter` | Yes | min/max | ISO-8601 date (`YYYY-MM-DD`); no time component |
| `time` | `time()` | Not supported | — | — | — | — | **Hard ban** — use `timetz` or `timestamptz` |
| `time with time zone` (`timetz`) | `time({ withTimezone: true })` | Supported (custom scalar) | `TimeTz` | `TimeTzFilter` | Yes | min/max | ISO-8601 time with offset (e.g. `13:45:00.000+05:30`); no date component |
| `timestamp` (without TZ) | `timestamp()` | Not supported | — | — | — | — | **Hard ban** — use `timestamptz` only ([§3.1](graphql-dal-requirements.md#31-custom-scalars)) |
| `timestamp with time zone` (`timestamptz`) | `timestamp({ withTimezone: true })` | Supported (custom scalar) | `DateTime` | `DateTimeFilter` | Yes | min/max | UTC normalized; ISO-8601 wire with `Z` |
| `interval` | `interval()` | Supported (custom scalar) | `IntervalMs` | `IntervalMsFilter` | Yes | min/max | Total duration as signed 64-bit **milliseconds** on wire; PG `interval` parsed to ms on read, ms converted to PG interval on write |

### UUID

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `uuid` | `uuid()` | Supported | GraphQL **`ID`** (built-in) | `IDFilter` | Yes | min/max | PKs, FKs, cursor keyset values — **only** `uuid` PG columns map to `ID`; non-uuid columns never use `ID` |

### JSON

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `json` | `json()` | Not supported | — | — | — | — | Use typed columns or normalized child tables |
| `jsonb` | `jsonb()` | Not supported | — | — | — | — | Same — no arbitrary JSON on GraphQL surface |

### Binary

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `bytea` | `byte()` / custom | Not supported | — | — | — | — | Use object storage + `text` URL/reference column |

### Arrays

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `text[]`, `int[]`, `uuid[]`, etc. | `text().array()` etc. | Not supported | — | — | — | — | **All array variants** — use join tables or scalar columns |

### Network

Rare — codegen emits domain-specific scalars when these PG types appear in the Drizzle schema; not in default templates. Filters v1: **`eq` / `neq` only**.

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `inet` | custom | Supported (custom scalar) | `Inet` | `InetFilter` | Yes | min/max | String — CIDR/IP notation; validated on parse |
| `cidr` | custom | Supported (custom scalar) | `Cidr` | `CidrFilter` | Yes | min/max | String — CIDR notation |
| `macaddr` | custom | Supported (custom scalar) | `MacAddr` | `MacAddrFilter` | Yes | min/max | String — colon-separated hex (e.g. `08:00:2b:01:02:03`) |
| `macaddr8` | custom | Supported (custom scalar) | `MacAddr8` | `MacAddr8Filter` | Yes | min/max | String — EUI-64 colon-separated hex |

### Geometric

Rare — codegen emits domain-specific scalars when present; not in default templates. Filters v1: **`eq` / `neq` only**.

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `point` | custom | Supported (custom scalar) | `GeoPoint` | `GeoPointFilter` | Yes | — | JSON object `{ "x": number, "y": number }` on wire |
| `line` | custom | Supported (custom scalar) | `Line` | `LineFilter` | Yes | — | WKT string (e.g. `{1 2,3 4}`) |
| `lseg` | custom | Supported (custom scalar) | `LSeg` | `LSegFilter` | Yes | — | WKT string |
| `box` | custom | Supported (custom scalar) | `Box` | `BoxFilter` | Yes | — | WKT string |
| `path` | custom | Supported (custom scalar) | `Path` | `PathFilter` | Yes | — | WKT string |
| `polygon` | custom | Supported (custom scalar) | `Polygon` | `PolygonFilter` | Yes | — | WKT string |
| `circle` | custom | Supported (custom scalar) | `Circle` | `CircleFilter` | Yes | — | WKT string |

### PostGIS / spatial

Rare — requires PostGIS extension. Codegen emits scalars when present; not in default templates. Filters v1: **`eq` / `neq` only**.

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `geometry` | PostGIS extension | Supported (custom scalar) | `Geometry` | `GeometryFilter` | Yes | — | GeoJSON string on wire |
| `geography` | PostGIS extension | Supported (custom scalar) | `Geography` | `GeographyFilter` | Yes | — | GeoJSON string on wire |

### Full-text

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `tsvector` | custom | Not supported | — | — | — | — | Use external search (OpenSearch, etc.) |
| `tsquery` | custom | Not supported | — | — | — | — | |

### Range

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `int4range`, `int8range`, `numrange`, `tsrange`, `tstzrange`, `daterange` | custom | Not supported (deliberation) | — | — | — | — | v1 codegen **fails** — see [§ Range deliberation](#range-deliberation); **recommended:** two scalar columns (`effectiveFrom` / `effectiveTo`, `minQty` / `maxQty`) |

### Composite / domain / custom

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| User-defined composite types | custom | Not supported | — | — | — | — | Flatten to scalar columns |
| `pgEnum` (Drizzle `pgEnum`) | `pgEnum()` | Supported | GraphQL enum | `<Enum>Filter` | Yes | — | Same member values as Drizzle ([§2.6](graphql-dal-requirements.md#26-enum-inference)) |
| Domain types | custom | Not supported | — | — | — | — | Unless domain is a thin alias of a supported base type — then map to base |

### Other

| PG type | Drizzle builder | DAL support | DAL scalar | Filter | Sort | Aggregate | Notes |
| ------- | --------------- | ----------- | ---------- | ------ | ---- | --------- | ----- |
| `oid` | — | Not supported | — | — | — | — | Catalog type |
| `xml` | custom | Not supported | — | — | — | — | Store as `text` if needed |
| `bit(n)`, `varbit(n)` | custom | Not supported | — | — | — | — | Use `boolean` or `text` |
| `pg_lsn` | — | Not supported | — | — | — | — | Replication internal |

**Codegen failure message (unsupported type):** `Column '<table>.<column>' uses unsupported PostgreSQL type '<pgType>'. Normalize to a supported scalar column, child table, Redis, or object storage. See dal-pg-type-mapping.md#postgresql-type-coverage.`

---

## PG → DAL type mapping

Formal mapping for **supported** PostgreSQL types only:

| PostgreSQL | GraphQL output scalar | Create / Update input | Filter input | Sort | Aggregate (sum / avg / min / max) | Cursor keyset |
| ---------- | --------------------- | ------------------- | ------------ | ---- | --------------------------------- | ------------- |
| `smallint`, `integer` | `Int` | `Int` | `IntFilter` | `<Entity>Field` | NumericFields / ComparableFields | `Int` in cursor `values` |
| `bigint` | `BigInt` | `BigInt` | `BigIntFilter` | `<Entity>Field` | NumericFields / ComparableFields | `BigInt` (string) in cursor `values` |
| `numeric` / `decimal` | `Decimal` | `Decimal` | `DecimalFilter` | `<Entity>Field` | NumericFields / ComparableFields | `Decimal` (string) in cursor `values` |
| `real`, `double precision` | `Float` | `Float` | `FloatFilter` | `<Entity>Field` | NumericFields / ComparableFields | `Float` in cursor `values` |
| `char`, `varchar`, `text`, `citext` | `String` | `String` | `StringFilter` | `<Entity>Field` | ComparableFields (min/max) | `String` in cursor `values` |
| `boolean` | `Boolean` | `Boolean` | `BooleanFilter` | `<Entity>Field` | — | `Boolean` in cursor `values` |
| `date` | `Date` | `Date` | `DateFilter` | `<Entity>Field` | ComparableFields (min/max) | `Date` in cursor `values` |
| `timestamptz` | `DateTime` | `DateTime` | `DateTimeFilter` | `<Entity>Field` | ComparableFields (min/max) | `DateTime` in cursor `values` |
| `timetz` | `TimeTz` | `TimeTz` | `TimeTzFilter` | `<Entity>Field` | ComparableFields (min/max) | `TimeTz` in cursor `values` |
| `interval` | `IntervalMs` | `IntervalMs` | `IntervalMsFilter` | `<Entity>Field` | ComparableFields (min/max) | `IntervalMs` (string) in cursor `values` |
| `uuid` | `ID` | `ID` | `IDFilter` | `<Entity>Field` | ComparableFields (min/max) | `ID` in cursor `values` |
| `pgEnum` | GraphQL enum | Same enum | `<Enum>Filter` | `<Entity>Field` | — | Enum string in cursor `values` |
| `inet`, `cidr`, `macaddr`, `macaddr8` | respective custom scalar | same | respective `*Filter` | `<Entity>Field` | ComparableFields (min/max) where applicable | scalar string in cursor `values` |
| `point` … `circle`, `geometry`, `geography` | respective custom scalar | same | respective `*Filter` | `<Entity>Field` | — | scalar string in cursor `values` |

### v1 scalar decisions (rationale)

| Decision | Choice | Rationale |
| -------- | ------ | ----------- |
| **`bigint`** | Custom **`BigInt`** scalar — **string on wire** | GraphQL `Int` is 32-bit signed; PostgreSQL `bigint` exceeds that. String encoding is JSON-safe and matches common GraphQL BigInt patterns |
| **`numeric` / `decimal`** | Custom **`Decimal`** scalar — **string on wire** | Avoids IEEE Float precision loss for monetary amounts and fixed-scale decimals; clients parse with decimal libraries |
| **`date`** | Custom **`Date`** scalar — ISO-8601 date | Calendar dates without time are common (birthdays, effective dates); simpler than overloading `DateTime` |
| **`money`** | **Not supported (hard ban)** | Entity validation and codegen **fail**; store as `integer` cents (`Int`) or `numeric`/`decimal` + `Decimal` — never PG `money` |
| **`time` (no TZ)** | **Not supported** | Ambiguous local time — **hard ban**; use `timetz` or `timestamptz` |
| **`timetz`** | Custom **`TimeTz`** scalar — ISO-8601 time with offset | Time-of-day with timezone (e.g. store hours, daily cutoff); distinct from `timestamptz` instants |
| **`timestamp` (no TZ)** | **Not supported** | Ambiguous local time — **`timestamptz` only** ([§3.1](graphql-dal-requirements.md#31-custom-scalars), entity design) |
| **`interval`** | Custom **`IntervalMs`** scalar — **milliseconds on wire** | Signed 64-bit integer as decimal string; PG `interval` ↔ total ms conversion in repository layer; JS/API convention, sub-second precision, avoids float |
| **`uuid`** | GraphQL built-in **`ID`** — not a custom scalar | Relay/node identification convention; RFC 4122 validation at repository/DB — see [UUID → ID tradeoffs](#uuid--id-tradeoffs) |
| **`citext`** | **Supported** as `String` | Case-insensitive storage in PG; DAL filter uses existing `StringFilter.caseInsensitive` |
| **Network, geometric, PostGIS** | **Supported (custom scalar, opt-in)** | Rare domain types — codegen emits when present in Drizzle schema; not in default templates; filters v1 limited to `eq` / `neq` |
| **Range types** | **Not supported v1 (deliberation)** | v1 codegen fails — see [§ Range deliberation](#range-deliberation); recommended: two-column normalization |
| **Arrays, JSON, binary, full-text** | **Hard ban v1** | No typed GraphQL surface without arbitrary JSON — normalize schema instead |

---

## Custom DAL scalars registry

Codegen emits **six core custom scalars** in the generated base SDL ([§3.1](graphql-dal-requirements.md#31-custom-scalars)). Built-in GraphQL scalars (`Int`, `Float`, `String`, `Boolean`, **`ID`**) are used where no precision or wire-format concerns exist.

| Scalar | Wire format | PG source types | Validation | Parse error |
| ------ | ----------- | --------------- | ---------- | ----------- |
| **`DateTime`** | ISO-8601 UTC with milliseconds and `Z` suffix — e.g. `2026-09-10T13:28:00.000Z` | `timestamptz` | Parseable ISO-8601; normalize offsets to UTC | `BAD_USER_INPUT` |
| **`Date`** | ISO-8601 calendar date — `YYYY-MM-DD` | `date` | Valid calendar date; no time or timezone | `BAD_USER_INPUT` |
| **`TimeTz`** | ISO-8601 time with offset — e.g. `13:45:00.000+05:30` or `13:45:00Z` (no date component) | `timetz` | Valid time with offset; reject date components | `BAD_USER_INPUT` |
| **`BigInt`** | Decimal integer string — e.g. `"9223372036854775807"` | `bigint` | Matches `/^-?\d+$/`; must fit signed 64-bit PG range | `BAD_USER_INPUT` |
| **`Decimal`** | Decimal string — e.g. `"1234.56"` or `"99"` | `numeric`, `decimal` | Valid decimal notation; no scientific notation in v1 | `BAD_USER_INPUT` |
| **`IntervalMs`** | Signed decimal integer string of **total milliseconds** — e.g. `"3600000"`, `"-1500"` | `interval` | Matches `/^-?\d+$/`; must fit signed 64-bit range | `BAD_USER_INPUT` |

### Opt-in custom scalars (rare)

Codegen emits these **only when** the corresponding PG type appears in the Drizzle schema — not in default templates. Filters v1: **`eq` / `neq` only**.

| Group | Scalars | Wire format |
| ----- | ------- | ------------- |
| **Network** | `Inet`, `Cidr`, `MacAddr`, `MacAddr8` | Validated string in PG-native notation |
| **Geometric** | `GeoPoint`, `Line`, `LSeg`, `Box`, `Path`, `Polygon`, `Circle` | `GeoPoint`: JSON `{x,y}`; others: WKT string |
| **PostGIS** | `Geometry`, `Geography` | GeoJSON string |

### Built-in scalars

Built-in scalars (no custom registry entry): **`Int`** ← `smallint`, `integer`; **`Float`** ← `real`, `double precision`; **`String`** ← `char`, `varchar`, `text`, `citext`; **`Boolean`** ← `boolean`; **`ID`** ← `uuid` **only** — never map non-uuid columns to `ID`.

GraphQL enums map from Drizzle `pgEnum` — not custom scalars ([§2.6](graphql-dal-requirements.md#26-enum-inference)).

### UUID → ID tradeoffs

PostgreSQL `uuid` columns map to GraphQL **`ID`** (built-in), not a custom `UUID` scalar.

| | |
| --- | --- |
| **Pros** | Relay/node identification convention; no custom scalar to register or document; familiar to GraphQL clients and tooling |
| **Cons** | `ID` does not enforce RFC 4122 at the GraphQL parse layer — it accepts any opaque string until repository/DB validation rejects malformed values |

RFC 4122 validation runs at repository write and on filter/mutation args before SQL bind. Serialize lowercases canonical UUID strings on output.

### Range deliberation

PostgreSQL range types (`int4range`, `int8range`, `numrange`, `tsrange`, `tstzrange`, `daterange`) are **not supported in v1 auto-DAL**. Codegen **fails** with a message suggesting normalization. Two design options under consideration:

**Option A — Custom range scalars**

| Aspect | Detail |
| ------ | ------ |
| **Scalars** | Per-type: `Int4Range`, `Int8Range`, `NumRange`, `TsRange`, `TstzRange`, `DateRange` |
| **Wire format** | PostgreSQL range literal string (e.g. `[1,10)`) **or** structured JSON `{ lower, upper, lowerInclusive, upperInclusive }` |
| **Filters** | Overlap, contains, contained-by — complex in v1; likely deferred |
| **Tradeoff** | Preserves single-column PG semantics; harder filter/sort/codegen surface |

**Option B — Normalize to two columns (recommended for v1)**

| Aspect | Detail |
| ------ | ------ |
| **Pattern** | `effectiveFrom` / `effectiveTo` (`timestamptz`), `minQty` / `maxQty` (`integer`), etc. |
| **Filters** | Full filter/sort support via existing scalars (`DateTimeFilter`, `IntFilter`, …) |
| **Indexing** | Two scalar columns index cleanly for range queries |
| **Tradeoff** | Two columns instead of one PG range; explicit null-open-bound semantics in schema comments |

**v1 codegen default:** **Not supported (deliberation)** — fail with message suggesting Option B (two-column normalization) or explicit opt-in range scalars if added in a future version. Schema authors should prefer two-column patterns — see [DAL Entity Design Guidelines § Column Types](dal-entity-design.md#column-types).

---

**Related:** [GraphQL DAL Requirements](graphql-dal-requirements.md) | [DAL Entity Design Guidelines](dal-entity-design.md) | [Developer Guides](README.md)

**Last updated:** September 11, 2026
