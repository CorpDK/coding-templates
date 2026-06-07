# GraphQL Data Access Layer — Requirements Specification (Final Revision)

---

## 1. Overview

This document defines a **generic, entity-agnostic GraphQL Data Access Layer (DAL)** that provides:

* Fully abstracted database access
* Strong typing (no arbitrary JSON inputs/outputs)
* Advanced filtering, pagination, sorting, and aggregation
* Auto-generated queries, mutations, and subscriptions

---

## 2. Data Model Requirements

Each entity must include:

* `id` (Primary Key)
* `createdAt`
* `updatedAt`
* `createdBy`
* `updatedBy`

---

## 3. Auto-Generated API

For every entity `<Entity>`, the system must auto-generate:

### Queries

* `list<Entity>`
* `list<Entity>Connection`
* `get<Entity>ById`
* `count<Entity>` (optional shortcut)
* `aggregate<Entity>`

### Mutations

* `create<Entity>`
* `bulkCreate<Entity>`
* `update<Entity>`
* `bulkUpdate<Entity>`
* `bulkUpdate<Entity>ByFilter`
* `delete<Entity>`
* `bulkDelete<Entity>`
* `bulkDelete<Entity>ByFilter`

### Subscriptions

* `<entity>Changed`

---

## 4. Query Design

### 4.1 Unified List

```graphql
list<Entity>(
  filter: <EntityFilter>
  sort: [SortInput!]
): [Entity!]!
```

---

### 4.2 Paginated List

```graphql
list<Entity>Connection(
  filter: <EntityFilter>
  pagination: PaginationInput
): <Entity>Connection!
```

---

### 4.3 Get By ID

```graphql
get<Entity>ById(id: UUID!): Entity
```

---

## 5. Mutations

### 5.1 Create

```graphql
create<Entity>(input: <EntityCreateInput!>): Entity!
bulkCreate<Entity>(inputs: [<EntityCreateInput!>]!): [Entity!]!
```

---

### 5.2 Update

```graphql
update<Entity>(id: UUID!, input: <EntityUpdateInput!>): Entity!
```

---

### 5.3 Bulk Update (Typed Map)

```graphql
input <Entity>UpdateEntry {
  key: UUID!
  value: <EntityUpdateInput!>
}

bulkUpdate<Entity>(
  updates: [<Entity>UpdateEntry!]!
): [Entity!]!
```

---

### 5.4 Bulk Update by Filter

```graphql
bulkUpdate<Entity>ByFilter(
  filter: <EntityFilter!>
  input: <EntityUpdateInput!>
): Int!
```

---

### 5.5 Delete

```graphql
delete<Entity>(id: UUID!): Boolean!
bulkDelete<Entity>(ids: [UUID!]!): Int!
bulkDelete<Entity>ByFilter(filter: <EntityFilter!>): Int!
```

---

## 6. Filtering System

### 6.1 Logical Operators

* AND
* OR
* NOT

---

### 6.2 String Filter (Revised)

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

✔ `ilike` removed
✔ `like + caseInsensitive = true` replaces it

---

### 6.3 Other Filters

* Numeric
* Boolean
* DateTime
* UUID

(All strongly typed)

---

### 6.4 Relation Filters

* `some`
* `every`
* `none`

Fully recursive.

---

## 7. Sorting

```graphql
input SortInput {
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

---

### Rules

* Available in both:

  * list queries
  * pagination
* System enforces deterministic sorting with `id` tie-breaker

---

## 8. Pagination

### 8.1 Input

```graphql
input PaginationInput {
  first: Int
  after: String

  last: Int
  before: String

  sort: [SortInput!]
}
```

---

### 8.2 PageInfo

```graphql
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
  request: PaginationRequestInfo
}
```

---

### 8.3 Request Echo

```graphql
type PaginationRequestInfo {
  first: Int
  after: String

  last: Int
  before: String

  sort: [SortInput!]
}
```

---

## 9. Aggregation System (Strongly Typed)

## 9.1 Column Selection (Typed)

```graphql
input <Entity>NumericFields {
  fieldA: Boolean
  fieldB: Boolean
  fieldC: Boolean
}
```

👉 Only numeric fields are included in this type

---

## 9.2 Aggregate Input

```graphql
input <Entity>AggregateInput {
  count: Boolean

  sum: <Entity>NumericFields
  avg: <Entity>NumericFields
  min: <Entity>ComparableFields
  max: <Entity>ComparableFields
}
```

---

## 9.3 Aggregate Result (Strongly Typed)

```graphql
type <Entity>AggregateResult {
  count: Int

  sum: <Entity>NumericResult
  avg: <Entity>NumericResult
  min: <Entity>ComparableResult
  max: <Entity>ComparableResult
}

type <Entity>NumericResult {
  fieldA: Float
  fieldB: Float
  fieldC: Float
}

type <Entity>ComparableResult {
  fieldA: String
  fieldB: String
  fieldC: String
}
```

---

## 9.4 Aggregate Query

```graphql
aggregate<Entity>(
  filter: <EntityFilter>
  input: <Entity>AggregateInput!
): <Entity>AggregateResult!
```

---

### Rules

* `sum` and `avg` operate only on numeric fields
* `min` and `max` operate on comparable fields (numeric, date, string, etc.)
* Fields explicitly selected via boolean flags
* No arbitrary column names allowed
* `count` included as part of aggregate

---

## 10. Cursor Design

* Opaque (Base64 encoded)
* Contains:

  * version
  * sort fields
  * sort directions
  * values
* Deterministic and stable

---

## 11. SQL Generation Layer

Responsibilities:

* Filter → WHERE
* Sort → ORDER BY
* Cursor → SEEK pagination
* Aggregation → SQL aggregate functions
* Shared logic across:

  * list
  * count
  * aggregate
  * bulk operations

---

## 12. Subscriptions

### 12.1 Auto-Generated

For each entity:

```graphql
<Entity>Changed: <EntityChangePayload!>
```

---

### 12.2 Payload

```graphql
type <EntityChangePayload> {
  operation: ChangeOperation!
  ids: [UUID!]!
}

enum ChangeOperation {
  CREATED
  UPDATED
  DELETED
}
```

---

### 12.3 Rules

* All mutations trigger subscriptions
* Bulk + single mutations emit the same event type
* Payload contains affected IDs
* Clients refetch using queries

---

## 13. Performance Requirements

* Keyset pagination only (no OFFSET)
* Indexed sorting fields
* Lazy aggregation (only when requested)
* Field-level selection optimization

---

## 14. Security Requirements

* Strong typing (no JSON inputs)
* Field whitelisting for filter/sort
* Parameterized SQL queries
* Optional cursor signing

---

## 15. Extensibility

* Add new entities without redesign
* Extend filters and aggregations
* Support multiple databases
* Plug-in architecture for resolvers

---

## 16. Final Outcome

This system provides:

* A **fully typed GraphQL query engine**
* Zero SQL exposure to clients
* High-performance pagination
* Strongly typed aggregation system
* Unified mutation + subscription model
* Reusable architecture across all projects

---

**End of Document**
