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
  
  const atOrBelowCapacity = rateLimiterStats.activeRequests <= rateLimiterStats.maxConcurrent;
  const hasBacklog = rateLimiterStats.queueLength > 0;
  const isHealthy = !circuitBreakerStatus.isOpen && atOrBelowCapacity && !hasBacklog;
  
  // Always return 200 OK with status payload to avoid triggering load balancer alerts
  // during normal traffic bursts. Circuit OPEN is the only true unhealthy state.
  const status = circuitBreakerStatus.isOpen ? 'unhealthy' : 
                 hasBacklog ? 'degraded' : 
                 'healthy';
  
  return NextResponse.json({
    status,
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
    status: circuitBreakerStatus.isOpen ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
