/**
 * EzyGo API Batch Fetcher with Request Deduplication and Rate Limiting
 * 
 * Solves the concurrent user problem by:
 * 1. Deduplicating identical in-flight requests (15-second cache window)
 * 2. Rate limiting concurrent requests to max 3 at a time
 * 3. Queueing additional requests to prevent overwhelming the API
 * 
 * Example: 20 concurrent users = max 3 concurrent API calls instead of 120
 */

import { LRUCache } from 'lru-cache';
import { logger } from './logger';
import { ezygoCircuitBreaker } from './circuit-breaker';
import { createHash } from 'crypto';

// 1. SHORT-LIVED CACHE (15 seconds) - Handles burst traffic
// Stores in-flight request promises, not results
// This allows multiple concurrent callers to await the same request
const requestCache = new LRUCache<string, Promise<any>>({
  max: 500,
  ttl: 15000, // 15 seconds - good balance for deduplication without stale data
  updateAgeOnGet: false, // Don't reset TTL on access
  updateAgeOnHas: false,
});

// 2. RATE LIMITER - Conservative limit to avoid EzyGo rate limiting
// With a single server IP, we must be very careful not to trigger rate limits
// MAX_CONCURRENT = 3 means max 3 simultaneous requests from server to EzyGo
// This is conservative but safe - increase only if you verify EzyGo's limits
let activeRequests = 0;
const MAX_CONCURRENT = 3; // Conservative: 3 concurrent requests from single IP
const requestQueue: Array<() => void> = [];

/**
 * Wait for an available request slot
 * If max concurrent requests reached, queues the request
 */
function waitForSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  
  return new Promise((resolve) => {
    requestQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

/**
 * Release a request slot and process queue
 */
function releaseSlot() {
  activeRequests--;
  const next = requestQueue.shift();
  if (next) {
    next();
  }
}

/**
 * Smart fetch with deduplication and rate limiting
 * 
 * @param endpoint - API endpoint path (e.g., '/myprofile')
 * @param token - EzyGo access token
 * @param method - HTTP method (default: 'GET')
 * @param body - Request body for POST/PUT
 * @returns Promise with API response data
 */
export async function fetchEzygoData<T>(
  endpoint: string,
  token: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<T> {
  // Create secure cache key using SHA-256 hash of token + method + endpoint + body
  // This prevents cross-user request deduplication from token suffix collisions
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 16);
  const cacheKey = `${method}:${tokenHash}:${endpoint}:${JSON.stringify(body || {})}`;
  
  // Check if request is already in-flight
  const existingRequest = requestCache.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }
  
  // Create new request with rate limiting and circuit breaker
  const requestPromise = (async () => {
    await waitForSlot();
    
    try {
      const result = await ezygoCircuitBreaker.execute(async () => {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        if (!backendUrl) {
          throw new Error('NEXT_PUBLIC_BACKEND_URL is not configured');
        }

        // Remove trailing slash from base URL and leading slash from endpoint to avoid double slashes
        const baseUrl = backendUrl.replace(/\/+$/, '');
        const cleanEndpoint = endpoint.replace(/^\/+/, '');
        const url = `${baseUrl}/${cleanEndpoint}`;
        
        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });

        if (!response.ok) {
          throw new Error(`EzyGo API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
      });
      
      return result;
    } finally {
      releaseSlot();
      // Remove from cache after a short delay to allow concurrent requests to share
      setTimeout(() => {
        requestCache.delete(cacheKey);
      }, 100);
    }
  })();
  
  // Cache the promise (not the result) so concurrent requests share the same fetch
  requestCache.set(cacheKey, requestPromise);
  
  return requestPromise;
}

/**
 * Batch fetch all dashboard data in parallel
 * Respects global rate limit but fetches concurrently when slots available
 * 
 * @param token - EzyGo access token
 * @returns Promise with profile, courses, and attendance data
 */
export async function fetchDashboardData(token: string) {
  // These run concurrently but respect the global rate limit
  const [profile, courses, attendance] = await Promise.all([
    fetchEzygoData('/myprofile', token).catch((error) => {
      logger.error('[EzyGo] Failed to fetch profile', {
        context: 'ezygo-batch-fetcher',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }),
    fetchEzygoData('/institutionuser/courses/withusers', token).catch((error) => {
      logger.error('[EzyGo] Failed to fetch courses', {
        context: 'ezygo-batch-fetcher',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }),
    fetchEzygoData('/attendancereports/student/detailed', token, 'POST', {}).catch((error) => {
      logger.error('[EzyGo] Failed to fetch attendance', {
        context: 'ezygo-batch-fetcher',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    })
  ]);
  
  return { profile, courses, attendance };
}

/**
 * Get current rate limiter stats (for monitoring/debugging)
 */
export function getRateLimiterStats() {
  return {
    activeRequests,
    queueLength: requestQueue.length,
    maxConcurrent: MAX_CONCURRENT,
    cacheSize: requestCache.size,
  };
}
