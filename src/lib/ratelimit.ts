import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const syncRateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "10 s"),
  analytics: true,
  prefix: "@ghostclass/ratelimit",
});