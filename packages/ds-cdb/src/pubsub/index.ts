import { createPubSub } from "graphql-yoga";
import { createMemoryEventTarget } from "./memory.js";
// To switch to Redis/Valkey: see redis.ts, then swap the line below
// import { createRedisEventTarget } from "./redis.js";
import type { Item } from "../db/schemas.js";

/**
 * Type-safe pub/sub topics.
 * Add an entry for each subscription topic:
 *   TOPIC_NAME: [{ fieldName: PayloadType }]
 *
 * The payload must be wrapped under the subscription field name so that
 * Yoga's default resolver (event[fieldName]) can map it automatically.
 *
 * Example:
 *   PING_SENT: [{ pingSent: { message: string; timestamp: string } }]
 */
export type PubSubTopics = {
  PING_SENT: [{ pingSent: { message: string; timestamp: string } }];
  ITEM_CREATED: [{ itemCreated: Item }];
};

const eventTarget = createMemoryEventTarget();
// const eventTarget = createRedisEventTarget(); // ← swap here for Redis/Valkey

export const pubsub = createPubSub<PubSubTopics>({ eventTarget });
