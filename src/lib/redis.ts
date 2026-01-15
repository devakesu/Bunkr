import { Redis } from '@upstash/redis';

const redisClient = () => {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    throw new Error("Redis URL missing");
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
};

export const redis = new Proxy({} as Redis, {
  get: (_target, prop) => {
    const client = redisClient();
    return (client as any)[prop];
  }
});