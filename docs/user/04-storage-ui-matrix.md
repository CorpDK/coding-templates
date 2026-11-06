# Storage / UI Compatibility Matrix

Not every DS variant is compatible with every UI variant. This table shows valid combinations.

| Storage                                      | ORM / SDK  | DS package          | Compatible UI variants         |
| -------------------------------------------- | ---------- | ------------------- | ------------------------------ |
| `relational` + `prisma`                      | Prisma     | `@corpdk/ds-no-sql` | `standard` only                |
| `relational` + `drizzle`                     | Drizzle    | `@corpdk/ds`        | `hprt` only                    |
| `document` + Couchbase                       | Native SDK | `@corpdk/ds-cdb`    | `standard` or `hprt`           |
| `document` + MongoDB + `hprt`                | Native SDK | `@corpdk/ds-mongo`  | `standard` or `hprt`           |
| `document` + DocumentDB + `hprt`             | Native SDK | `@corpdk/ds-ddb`    | `standard` or `hprt`           |
| `document` + MongoDB/DocumentDB + `standard` | Prisma     | `@corpdk/ds-no-sql` | `standard` only                |
| `filebased`                                  | —          | `@corpdk/ds-file`   | `standard` or `hprt`           |
| _(UI only)_                                  | —          | —                   | `standard` or `hprt` + `--sdk` |

Stock UI templates stream subscriptions over **SSE** on the same `/api/graphql` proxy as queries and mutations. Every DS package in the table matches that transport on HTTP `/graphql` — see [DS subscription transport (SSE)](../developer/11-ds-subscription-sse.md).

---

## UI Variant Differences

|                    | `standard` (Apollo Client) | `hprt` (urql + Graphcache)          |
| ------------------ | -------------------------- | ----------------------------------- |
| **GraphQL client** | Apollo Client 3            | urql 5                              |
| **Cache strategy** | Normalised in-memory       | Graphcache (normalised, optimistic) |
| **Subscriptions**  | SSE (`graphql-sse`) via split link  | SSE (`graphql-sse` + `subscriptionExchange`) |
| **Best for**       | Standard CRUD UIs          | High-frequency real-time data       |

---

## DS Variant Differences

| DS package  | Storage                                                          | ORM / Driver        | Real-time optimised                                                                                                |
| ----------- | ---------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ds`        | PostgreSQL / MySQL / SQLite / CockroachDB                        | Drizzle             | Yes (SSE on HTTP `/graphql`; see [DS subscription SSE](../developer/11-ds-subscription-sse.md))                    |
| `ds-no-sql` | PostgreSQL / MySQL / SQLite / CockroachDB / MongoDB / DocumentDB | Prisma              | No (SSE on HTTP `/graphql`; see [DS subscription SSE](../developer/11-ds-subscription-sse.md))                     |
| `ds-cdb`    | Couchbase Capella / self-hosted                                  | Native SDK + Zod    | Yes (SSE on HTTP `/graphql`; see [DS subscription SSE](../developer/11-ds-subscription-sse.md))                    |
| `ds-mongo`  | MongoDB Atlas / self-hosted                                      | Native driver + Zod | Yes (SSE on HTTP `/graphql`; see [DS subscription SSE](../developer/11-ds-subscription-sse.md))                    |
| `ds-ddb`    | DocumentDB (documentdb.io)                                       | Native driver + Zod | Yes (SSE on HTTP `/graphql`; see [DS subscription SSE](../developer/11-ds-subscription-sse.md))                    |
| `ds-file`   | JSON or YAML file on disk                                        | fs/promises + Zod   | Yes (SSE on HTTP `/graphql`; in-memory pub/sub; see [DS subscription SSE](../developer/11-ds-subscription-sse.md)) |

---

**Related**: [Data Service Design](../architecture/03-data-service-design.md) | [Introduction](01-introduction.md) | [CLI Reference](03-cli-reference.md)

**Last updated**: March 31, 2026
