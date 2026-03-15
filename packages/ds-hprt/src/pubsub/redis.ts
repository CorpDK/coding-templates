import { createRedisEventTarget as createYogaRedisEventTarget } from "@graphql-yoga/redis-event-target";
import { Redis } from "ioredis";

export function createRedisEventTarget(): EventTarget {
  const redisUrl = process.env.REDIS_URL ?? "";
  const publishClient = new Redis(redisUrl);
  const subscribeClient = new Redis(redisUrl);
  return createYogaRedisEventTarget({
    publishClient,
    subscribeClient,
    serializer: { stringify: JSON.stringify, parse: JSON.parse },
  });
}
