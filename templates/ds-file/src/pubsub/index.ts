import { createPubSub } from "graphql-yoga";
import { createMemoryEventTarget } from "./memory.js";
import { createRedisEventTarget } from "./redis.js";
import type { Item } from "../storage/schemas.js";

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

const eventTarget = process.env.REDIS_URL
  ? createRedisEventTarget()
  : createMemoryEventTarget();

export const pubsub = createPubSub<PubSubTopics>({ eventTarget });
export type PubSub = typeof pubsub;
