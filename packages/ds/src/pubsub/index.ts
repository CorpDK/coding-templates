import { createPubSub } from "graphql-yoga";
import { createMemoryEventTarget } from "./memory.js";
// To switch to Redis/Valkey: see redis.ts, then swap the line below
// import { createRedisEventTarget } from "./redis.js";

/**
 * Type-safe pub/sub topics.
 * Add an entry for each subscription topic:
 *   TOPIC_NAME: [PayloadType]
 *
 * Example:
 *   PING_SENT: [{ message: string; timestamp: string }]
 */
export type PubSubTopics = {
  PING_SENT: [{ message: string; timestamp: string }];
};

const eventTarget = createMemoryEventTarget();
// const eventTarget = createRedisEventTarget(); // ← swap here for Redis/Valkey

export const pubsub = createPubSub<PubSubTopics>({ eventTarget });
