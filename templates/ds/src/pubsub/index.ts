import { createAppPubSub } from "@corpdk/pub-sub";
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

export const pubsub = createAppPubSub<PubSubTopics>();
export type PubSub = typeof pubsub;
