import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis"; 

export const syncRateLimiter = {
  limit: async (identifier: string) => {
    const limiter = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(5, "10 s"),
      analytics: true,
      prefix: "@ghostclass/ratelimit",
    });

    return limiter.limit(identifier);
  },
};