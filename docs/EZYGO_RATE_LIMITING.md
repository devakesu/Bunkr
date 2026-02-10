# EzyGo API Batch Fetcher & Rate Limiting

## Problem Statement

When multiple users access the dashboard simultaneously, the application makes 6 API calls per user to the EzyGo backend:
- `/myprofile` (profile data)
- `/institutionuser/courses/withusers` (courses)
- `/attendancereports/student/detailed` (attendance)
- Plus additional calls for settings

**Without optimization:**
- 20 concurrent users = **120 concurrent API requests** to EzyGo
- Risk of rate limiting
- Potential server overload
- Poor user experience

## Solution Overview

This implementation uses a hybrid approach combining:
1. **Server Components** - Fetch initial data server-side
2. **Request Deduplication** - Share in-flight requests across users
3. **Rate Limiting** - Maximum 3 concurrent requests at any time (default, configurable)
4. **Circuit Breaker** - Graceful degradation when API is down

**Result (with MAX_CONCURRENT = 3):**
- 20 concurrent users = **Max 3 concurrent API requests** to EzyGo at any moment
- ✅ Significantly reduces risk of rate limiting
- ✅ Maintains fast UX for early users
- ✅ Graceful queueing for later users
- ✅ Automatic recovery from API issues

## Architecture

### Components

#### 1. Circuit Breaker (`src/lib/circuit-breaker.ts`)

Implements the Circuit Breaker pattern to prevent cascading failures:

```
CLOSED → OPEN → HALF_OPEN → CLOSED
   ↑                           ↓
   └───────── (recovery) ──────┘
```

- **CLOSED**: Normal operation
- **OPEN**: API is down, fail fast (60 seconds)
- **HALF_OPEN**: Testing recovery (2 test requests)

Configuration:
- Opens after 3 consecutive failures
- Stays open for 60 seconds
- Tests with 2 requests before closing

#### 2. Batch Fetcher (`src/lib/ezygo-batch-fetcher.ts`)

Three-layer protection system:

**Layer 1: Request Deduplication (LRU Cache)**
- 60-second TTL cache
- Stores in-flight promises and resolved results for the duration of the TTL
- Multiple users share the same request

**Layer 2: Rate Limiting**
- Max 3 concurrent requests
- Automatic queuing for excess requests
- Fair distribution via FIFO queue

**Layer 3: Circuit Breaker Integration**
- Wraps all requests
- Automatic fail-fast when API is down
- Prevents wasted resources

#### 3. Server Components (`src/app/(protected)/dashboard/page.tsx`)

Server-side rendering with:
- Authentication check
- Token validation
- Pre-fetch dashboard data
- Pass to client component for hydration

#### 4. Client Component (`src/app/(protected)/dashboard/DashboardClient.tsx`)

Receives initial data and:
- Hydrates React Query cache
- Maintains existing functionality
- Falls back to client fetch if SSR fails

## Performance Analysis

### Concurrent User Scenario

**20 users hit /dashboard simultaneously:**

| Metric | Before | After |
|--------|--------|-------|
| Peak concurrent requests | 120 | 3 |
| First user load time | ~2s | ~2s (same) |
| 20th user load time | ~2s | ~6s (queued) |
| Rate limit risk | High 🔴 | Low 🟢 |
| Server load | High | Low |
| API stability | At risk | Protected |

### Request Flow

```
User 1-5:  Request → [Slot Available] → API → Response (immediate)
User 6-10: Request → [Queue] → [Slot Available] → API → Response (~2s wait)
User 11-15: Request → [Queue] → [Slot Available] → API → Response (~4s wait)
User 16-20: Request → [Queue] → [Slot Available] → API → Response (~6s wait)
```

If User 2 makes same request as User 1 within 60 seconds:
```
User 2: Request → [Cache Hit] → Shared Promise → Response (instant)
```

## Usage

### Fetching Dashboard Data

```typescript
import { fetchDashboardData } from '@/lib/ezygo-batch-fetcher';

// In Server Component
const { courses, attendance } = await fetchDashboardData(token);
```

### Individual API Calls

```typescript
import { fetchEzygoData } from '@/lib/ezygo-batch-fetcher';

// GET request
const profile = await fetchEzygoData('/myprofile', token);

// POST request
const attendance = await fetchEzygoData(
  '/attendancereports/student/detailed',
  token,
  'POST',
  {}
);
```

### Monitoring

```typescript
import { getRateLimiterStats } from '@/lib/ezygo-batch-fetcher';
import { ezygoCircuitBreaker } from '@/lib/circuit-breaker';

// Get current stats
const stats = getRateLimiterStats();
// { activeRequests: 3, queueLength: 5, maxConcurrent: 5, cacheSize: 12 }

const circuitStatus = ezygoCircuitBreaker.getStatus();
// { state: 'CLOSED', failures: 0, isOpen: false }
```

## Configuration

### Tuning Rate Limits

Edit `src/lib/ezygo-batch-fetcher.ts`:

```typescript
const MAX_CONCURRENT = 3; // Conservative for single-IP deployment
                          // Increase carefully after monitoring
                          // Recommended: Stay at 3 unless queue issues
```

**⚠️ IMPORTANT**: For single-IP deployments (one server), keep this at 3 to avoid rate limiting.

### Tuning Circuit Breaker

Edit `src/lib/circuit-breaker.ts`:

```typescript
private readonly failureThreshold = 3;      // Opens after 3 failures (conservative)
private readonly resetTimeout = 60000;      // 60s wait before retry (longer for safety)
private readonly halfOpenMaxRequests = 2;   // Test with 2 requests (conservative)
```

**⚠️ IMPORTANT**: Conservative settings protect single-IP deployments from getting flagged.

### Tuning Cache TTL

Edit `src/lib/ezygo-batch-fetcher.ts`:

```typescript
const requestCache = new LRUCache<string, Promise<any>>({
  max: 500,
  ttl: 60000, // Cache duration (ms) — covers queue wait + fetch timeout
});
```

## Error Handling

### Graceful Degradation

1. **Server-side fetch fails**: Client component fetches directly
2. **Circuit breaker opens**: Users see cached data or retry
3. **Individual request fails**: Error logged, null returned
4. **Queue timeout**: Requests wait in the queue for up to 30 seconds; after timeout, they fail with a clear error message
5. **Queue full**: If the queue reaches 100 items, new requests are immediately rejected to prevent memory exhaustion

### Logging

All operations are logged with context:

```typescript
[EzyGo] Making request: GET /myprofile
[EzyGo Rate Limiter] Active requests: 3/5
[Circuit Breaker] Circuit is OPEN - failing fast
```

## Testing

### Load Testing

```bash
# Simulate 20 concurrent users
for i in {1..20}; do
  curl -H "Cookie: ezygo_access_token=$TOKEN" \
       https://app.example.com/dashboard &
done
```

### Circuit Breaker Testing

```typescript
// Manually open circuit (for testing)
ezygoCircuitBreaker.reset();

// Trigger failures to open circuit
for (let i = 0; i < 6; i++) {
  try {
    await fetchEzygoData('/invalid', token);
  } catch (error) {
    console.log(`Failure ${i + 1}`);
  }
}

// Check state
console.log(ezygoCircuitBreaker.getStatus());
```

## Migration Guide

### Updating Other Pages

To add rate limiting to other pages:

1. **Make page async Server Component:**
```typescript
export default async function PageName() {
  const token = (await cookies()).get("ezygo_access_token")?.value;
  const data = await fetchEzygoData('/endpoint', token);
  return <ClientComponent initialData={data} />;
}
```

2. **Update client component to accept props:**
```typescript
export default function ClientComponent({ 
  initialData 
}: { 
  initialData: any 
}) {
  const { data } = useYourHook({ initialData });
}
```

3. **Update hook to accept initialData:**
```typescript
export const useYourHook = (options?: { initialData?: any }) => {
  return useQuery({
    queryKey: ["your-key"],
    queryFn: fetchFunction,
    initialData: options?.initialData,
  });
};
```

## Monitoring & Observability

### Recommended Metrics

Track these in production:

1. **Rate Limiter:**
   - Active requests count
   - Queue length
   - Average wait time

2. **Circuit Breaker:**
   - State transitions
   - Failure rate
   - Recovery time

3. **Cache:**
   - Hit rate
   - Miss rate
   - Cache size

### Sentry Integration

Already integrated via `logger.error()`:

```typescript
logger.error('[EzyGo] Failed to fetch data', {
  context: 'ezygo-batch-fetcher',
  error: error.message,
});
```

## Troubleshooting

### High Queue Length

**Problem:** Queue length consistently > 10

**Solutions:**
- Increase `MAX_CONCURRENT` (if API allows)
- Increase cache TTL for more deduplication
- Optimize API response times

### Circuit Breaker Frequently Opening

**Problem:** Circuit opens often during normal load

**Solutions:**
- Check EzyGo API health
- Increase `failureThreshold`
- Increase timeout duration
- Add retry logic

### Slow Initial Page Load

**Problem:** First user sees slow dashboard

**Solutions:**
- Reduce number of parallel requests
- Cache more aggressively
- Use stale-while-revalidate pattern

## Future Enhancements

1. **Redis-based cache**: Share cache across server instances
2. **Per-user rate limiting**: Prevent single user abuse
3. **Priority queue**: VIP users get faster service
4. **Adaptive rate limiting**: Adjust based on API response
5. **WebSocket updates**: Push updates instead of polling

## References

- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Request Deduplication](https://tanstack.com/query/latest/docs/framework/react/guides/request-deduplication)
- [Rate Limiting Strategies](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
