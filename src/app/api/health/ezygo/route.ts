import { NextResponse } from "next/server";
import { getRateLimiterStats } from "@/lib/ezygo-batch-fetcher";
import { ezygoCircuitBreaker } from "@/lib/circuit-breaker";

/**
 * Health check endpoint for EzyGo API integration
 * Returns rate limiter and circuit breaker status
 * 
 * GET /api/health/ezygo
 */
export async function GET() {
  const rateLimiterStats = getRateLimiterStats();
  const circuitBreakerStatus = ezygoCircuitBreaker.getStatus();
  
  const isHealthy = !circuitBreakerStatus.isOpen && 
                    rateLimiterStats.activeRequests < rateLimiterStats.maxConcurrent;
  
  return NextResponse.json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    rateLimiter: {
      activeRequests: rateLimiterStats.activeRequests,
      queueLength: rateLimiterStats.queueLength,
      maxConcurrent: rateLimiterStats.maxConcurrent,
      cacheSize: rateLimiterStats.cacheSize,
      utilizationPercent: Math.round(
        (rateLimiterStats.activeRequests / rateLimiterStats.maxConcurrent) * 100
      ),
    },
    circuitBreaker: {
      state: circuitBreakerStatus.state,
      failures: circuitBreakerStatus.failures,
      isOpen: circuitBreakerStatus.isOpen,
      lastFailTime: circuitBreakerStatus.lastFailTime 
        ? new Date(circuitBreakerStatus.lastFailTime).toISOString() 
        : null,
    },
  }, {
    status: isHealthy ? 200 : 503,
  });
}
