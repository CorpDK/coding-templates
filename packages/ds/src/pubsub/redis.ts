import { createRedisEventTarget as createYogaRedisEventTarget } from "@graphql-yoga/redis-event-target";
import { Redis } from "ioredis";

export function createRedisEventTarget(): EventTarget {
  const publishClient = new Redis(process.env.REDIS_URL!);
  const subscribeClient = new Redis(process.env.REDIS_URL!);
  return createYogaRedisEventTarget({
    publishClient,
    subscribeClient,
    serializer: { stringify: JSON.stringify, parse: JSON.parse },
  });
}
