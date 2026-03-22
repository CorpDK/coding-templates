import { createPubSub } from "graphql-yoga";
import { createMemoryEventTarget } from "./memory.js";
import { createRedisEventTarget } from "./redis.js";

/**
 * Creates a type-safe pub/sub instance wired to Redis (if REDIS_URL is set)
 * or an in-memory event target (for local dev / single-process deployments).
 *
 * Pass your app-specific topic map as the type parameter:
 *   const pubsub = createAppPubSub<MyTopics>();
 *
 * Example topic map:
 *   type MyTopics = {
 *     PING_SENT: [{ pingSent: { message: string; timestamp: string } }];
 *     ITEM_CREATED: [{ itemCreated: Item }];
 *   };
 */
export function createAppPubSub<T extends Record<string, [unknown]>>() {
  const eventTarget = process.env.REDIS_URL
    ? createRedisEventTarget()
    : createMemoryEventTarget();
  return createPubSub<T>({ eventTarget });
}

export { createMemoryEventTarget } from "./memory.js";
export { createRedisEventTarget } from "./redis.js";
