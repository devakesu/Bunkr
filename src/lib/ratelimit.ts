// src/lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

/**
 * Configurable rate limiter for different endpoints
 * 
 * Environment variables:
 * - RATE_LIMIT_REQUESTS: Max requests (default: 10)
 * - RATE_LIMIT_WINDOW: Window in seconds (default: 10)
 */

// Parse env with fallbacks
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS || "10", 10);
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || "10", 10);

// Validate values
if (RATE_LIMIT_REQUESTS < 1 || RATE_LIMIT_REQUESTS > 1000) {
  throw new Error(`RATE_LIMIT_REQUESTS must be between 1-1000, got: ${RATE_LIMIT_REQUESTS}`);
}
if (RATE_LIMIT_WINDOW < 1 || RATE_LIMIT_WINDOW > 3600) {
  throw new Error(`RATE_LIMIT_WINDOW must be between 1-3600 seconds, got: ${RATE_LIMIT_WINDOW}`);
}

// Parse and validate auth rate limit settings
const AUTH_LIMIT = parseInt(process.env.AUTH_RATE_LIMIT_REQUESTS || "5", 10);
const AUTH_WINDOW = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || "60", 10);

if (AUTH_LIMIT < 1 || AUTH_LIMIT > 1000) {
  throw new Error(`AUTH_RATE_LIMIT_REQUESTS must be between 1-1000, got: ${AUTH_LIMIT}`);
}
if (AUTH_WINDOW < 1 || AUTH_WINDOW > 3600) {
  throw new Error(`AUTH_RATE_LIMIT_WINDOW must be between 1-3600 seconds, got: ${AUTH_WINDOW}`);
}
// Log configuration in development
if (process.env.NODE_ENV === 'development') {
  console.log(`[Rate Limit] ${RATE_LIMIT_REQUESTS} requests per ${RATE_LIMIT_WINDOW}s`);
  console.log(`[Auth Rate Limit] ${AUTH_LIMIT} requests per ${AUTH_WINDOW}s`);
}

// Create rate limiter instances once at module load time
const syncLimiter = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(RATE_LIMIT_REQUESTS, `${RATE_LIMIT_WINDOW} s`),
  analytics: true,
  prefix: "@ghostclass/ratelimit",
});

const authLimiter = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(AUTH_LIMIT, `${AUTH_WINDOW} s`),
  analytics: true,
  prefix: "@ghostclass/auth-ratelimit",
});

/**
 * General rate limiter for sync, contact, and API endpoints
 */
export const syncRateLimiter = {
  limit: async (identifier: string) => {
    return syncLimiter.limit(identifier);
  },
};

/**
 * Stricter rate limiter for authentication endpoints
 */
export const authRateLimiter = {
  limit: async (identifier: string) => {
    return authLimiter.limit(identifier);
  },
};