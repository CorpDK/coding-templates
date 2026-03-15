/**
 * Redis/Valkey pub/sub adapter.
 *
 * To switch from in-memory:
 *   1. Install: pnpm add ioredis (ioredis is already a peer of @graphql-yoga/redis-event-target)
 *   2. Uncomment the code below
 *   3. In pubsub/index.ts, swap createMemoryEventTarget() for createRedisEventTarget()
 *
 * import { createRedisEventTarget } from "@graphql-yoga/redis-event-target";
 * import { Redis } from "ioredis";
 *
 * export function createRedisEventTarget(): EventTarget {
 *   const publishClient = new Redis(process.env.REDIS_URL!);
 *   const subscribeClient = new Redis(process.env.REDIS_URL!);
 *   return createRedisEventTarget({
 *     publishClient,
 *     subscribeClient,
 *     serializeMessage: JSON.stringify,
 *     deserializeMessage: JSON.parse,
 *   });
 * }
 */
export {};
