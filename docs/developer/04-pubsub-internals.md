# PubSub Internals

---

## Overview

All DS packages use `@corpdk/pub-sub` for event-driven subscriptions. The library exposes a single factory function:

```typescript
import { createAppPubSub } from "@corpdk/pub-sub";
```

`createAppPubSub<T>()` automatically selects:

- **Redis** (`@graphql-yoga/redis-event-target`) when `REDIS_URL` is set
- **In-memory** (`EventTarget`) otherwise

Never import `createMemoryEventTarget` or `createRedisEventTarget` directly in DS packages — always use the factory.

---

## Wiring PubSub in a DS Package

Define topics and create the instance once in `src/pubsub/index.ts`:

```typescript
import { createAppPubSub } from "@corpdk/pub-sub";

export type PubSubTopics = {
  PING_SENT: [{ pingSent: { message: string; timestamp: string } }];
  ITEM_CREATED: [{ itemCreated: Item }];
  // add more topics here as your schema grows
};

export const pubsub = createAppPubSub<PubSubTopics>();
export type PubSub = typeof pubsub;
```

---

## Publish Shape Rule

**Always publish as `{ fieldName: payload }`.**

Yoga's default field resolver maps `event[fieldName]` to the subscription field. If the payload is not wrapped under the field name, the resolver receives `undefined` and returns a `Cannot return null for non-nullable field` error.

### ✅ Correct pattern

```typescript
// PubSubTopics
PING_SENT: [{ pingSent: { message: string; timestamp: string } }];

// Mutation resolver
pubsub.publish("PING_SENT", { pingSent: result });

// Subscription resolver — subscribe only, no resolve
pingSent: {
  subscribe: () => pubsub.subscribe("PING_SENT"),
},
```

### ❌ Incorrect pattern

```typescript
// PubSubTopics
PING_SENT: [{ message: string; timestamp: string }];

// Mutation resolver — payload not wrapped
pubsub.publish("PING_SENT", result); // event.pingSent → undefined → null error
```

---

## Subscription Resolvers

Leverage Yoga's default field-name resolver — **no explicit `resolve` function is needed**.

```typescript
// schema.ts
pingSent: {
  subscribe: () => pubsub.subscribe("PING_SENT"),
},
// No resolve function — Yoga maps event.pingSent automatically
```

If you add a `resolve` function just to pass the event through, remove it and fix the publish shape instead.

---

## Every Mutation Needs a Subscription

This is a hard requirement. Every mutation must publish a PubSub event, and every mutation must have a corresponding subscription:

```graphql
type Mutation {
  """
  Creates an item. Publishes itemCreated.
  """
  createItem(name: String!): Item!
}

type Subscription {
  """
  Fires when an item is created via createItem.
  """
  itemCreated: Item!
}
```

See [GraphQL Schema](02-graphql-schema.md) for the full schema pattern documentation.

---

## Deployment

See [PubSub / Redis](../admin/03-pubsub-redis.md) for Redis connection string configuration and when to use Redis vs in-memory.

---

**Related**: [PubSub / Redis](../admin/03-pubsub-redis.md) | [GraphQL Schema](02-graphql-schema.md)

**Last updated**: March 31, 2026
