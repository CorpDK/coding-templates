# PubSub / Redis

All DS packages use a plugin-style pub/sub layer from `@corpdk/pub-sub`. The transport is selected automatically at startup based on the presence of `REDIS_URL`.

---

## Transport Selection

| `REDIS_URL` set? | Transport                                           |
| ---------------- | --------------------------------------------------- |
| No               | In-memory (`EventTarget`) — single process only     |
| Yes              | Redis / Valkey — works across multiple DS instances |

No code changes are required to switch transports. Set or unset `REDIS_URL` in the package's `.env`.

---

## Enabling Redis

Add to the DS package's `.env`:

```env
REDIS_URL=redis://localhost:6379
```

For Redis with authentication:

```env
REDIS_URL=redis://:yourpassword@localhost:6379
```

For Valkey (drop-in Redis replacement):

```env
REDIS_URL=redis://localhost:6379
```

The connection string format is the same for both Redis and Valkey.

---

## When to Use Redis

| Scenario                                   | Recommendation                                                        |
| ------------------------------------------ | --------------------------------------------------------------------- |
| Single DS instance, development            | In-memory (no `REDIS_URL`)                                            |
| Production with a single DS instance       | Either works; Redis gives durability                                  |
| Multiple DS instances / horizontal scaling | **Redis required** — in-memory pub/sub is not shared across processes |
| Serverless / edge DS deployment            | Redis required                                                        |

---

## How It Works

`createAppPubSub<T>()` from `@corpdk/pub-sub` wraps either `createMemoryEventTarget` or `@graphql-yoga/redis-event-target` depending on `REDIS_URL`. Each DS package calls it once in `src/pubsub/index.ts`:

```typescript
import { createAppPubSub } from "@corpdk/pub-sub";

export type PubSubTopics = {
  ITEM_CREATED: [{ itemCreated: Item }];
  // ...
};

export const pubsub = createAppPubSub<PubSubTopics>();
```

Resolvers publish events; subscription resolvers subscribe to topics. The transport is entirely transparent to the application code.

See [PubSub Internals](../developer/04-pubsub-internals.md) for the full developer-facing documentation.

---

**Related**: [PubSub Internals](../developer/04-pubsub-internals.md) | [Environment Variables](01-environment-variables.md)

**Last updated**: March 31, 2026
