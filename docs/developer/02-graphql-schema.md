# GraphQL Schema

---

## Schema Directory Layout

The GraphQL schema lives in `src/schema/` — a directory of `.graphqls` files, not inline TypeScript. `schema.ts` scans the directory at runtime, sorts files alphabetically, and merges them into a single SDL string.

```text
src/schema/
├── base.graphqls      ← declares empty root types: type Query / Mutation / Subscription
├── server.graphqls    ← server health types + extend type Query/Mutation/Subscription
└── item.graphqls      ← Item type + extend type Query/Mutation/Subscription
```

**Adding a new entity** = create one new file (e.g. `src/schema/order.graphqls`) with the type definition and `extend type` blocks. No other files need editing.

---

## File Structure for a New Entity

```graphql
"""
An order.
"""
type Order {
  """
  Unique identifier.
  """
  id: ID!
}

extend type Query {
  """
  Returns all orders.
  """
  orders: [Order!]!
}

extend type Mutation {
  """
  Creates a new order. Publishes orderCreated.
  """
  createOrder(itemId: ID!): Order!
}

extend type Subscription {
  """
  Fires when an order is created via createOrder.
  """
  orderCreated: Order!
}
```

---

## Docstring Requirements

Every element of a GraphQL schema **must** have a `"""docstring"""`. This is a hard requirement — the schema is the public API contract. Altair, GraphQL IDE explorers, and generated SDK consumers all rely on these descriptions.

### Required Coverage

| Element                                          | Requirement                                      |
| ------------------------------------------------ | ------------------------------------------------ |
| Root types (`Query`, `Mutation`, `Subscription`) | One-line description of the operation category   |
| Object types                                     | One-line description of what the type represents |
| Every field                                      | What the field returns and when it's useful      |
| Every argument                                   | What the argument controls or filters            |
| Enum values                                      | What each value means                            |

### Example

❌ **Bad** — no descriptions:

```graphql
type Query {
  hello(name: String): String!
  status: ServerStatus!
}

type ServerStatus {
  ok: Boolean!
  timestamp: String!
}
```

✅ **Good** — fully documented:

```graphql
"""
Entry points for read-only data fetching.
"""
type Query {
  """
  Returns a personalised greeting. Omit name to receive the default.
  """
  hello(
    """
    Optional name to include in the greeting.
    """
    name: String
  ): String!

  """
  Returns the current server health status and a server-side timestamp.
  """
  status: ServerStatus!
}

"""
Current health state of the server.
"""
type ServerStatus {
  """
  True when the server is operating normally.
  """
  ok: Boolean!

  """
  ISO-8601 timestamp of when this status was generated.
  """
  timestamp: String!
}
```

---

## Docstring Rules

1. **No bare types** — every `type`, `input`, `enum`, `interface`, `union`, and `scalar` needs a description
2. **No bare fields** — every field needs a description, even if it seems obvious (`id`, `createdAt`)
3. **No bare arguments** — every argument needs a description explaining what it filters or controls
4. **Use ISO-8601 in timestamp descriptions** — e.g. `"ISO-8601 timestamp of when..."`
5. **Mutations describe their side effect** — include what gets published/triggered, not just what gets returned
6. **Subscriptions describe their trigger** — explain what mutation or event fires the subscription

---

## Mutation + Subscription Pairing

**Every mutation must be accompanied by a corresponding subscription.** Mutations publish a PubSub event; clients subscribe for real-time feedback without polling. This is a hard requirement — do not add a mutation without its subscription counterpart.

```graphql
type Mutation {
  """
  Creates a new document record. Publishes documentCreated.
  """
  createDocument(input: CreateDocumentInput!): Document!
}

type Subscription {
  """
  Fires when a document is created via the createDocument mutation.
  """
  documentCreated: Document!
}
```

---

## Code Review Checklist

- [ ] All GraphQL types, fields, and arguments have `"""docstrings"""`
- [ ] GraphQL SDL is in `src/schema/*.graphqls`, not inline in TypeScript
- [ ] Every mutation has a corresponding subscription
- [ ] Subscription field name matches the publish payload key (see [PubSub Internals](04-pubsub-internals.md))

---

**Related**: [Repository Pattern](03-repository-pattern.md) | [PubSub Internals](04-pubsub-internals.md) | [Data Service Design](../architecture/03-data-service-design.md)

**Last updated**: March 31, 2026
