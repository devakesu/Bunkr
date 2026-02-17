# EzyGo API Integration Guide

Complete documentation for EzyGo API rate limiting, batch fetcher implementation, and verification.

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution Architecture](#solution-architecture)
- [Performance Analysis](#performance-analysis)
- [Using the Batch Fetcher](#using-the-batch-fetcher)
- [Implementation Coverage](#implementation-coverage)
- [Configuration](#configuration)
- [Optimization for Single-IP Deployment](#optimization-for-single-ip-deployment)

---

## Overview

The EzyGo API integration uses a sophisticated three-layer protection system to prevent rate limiting and ensure reliable access to attendance data. This system combines request deduplication, rate limiting, and circuit breaker patterns to optimize concurrent user access while protecting both the EzyGo API and our application.

**Key Features:**
- ✅ Request deduplication with LRU caching
- ✅ Configurable rate limiting (default: 3 concurrent requests)
- ✅ Circuit breaker for graceful degradation
- ✅ Server-side rendering (SSR) for faster initial load
- ✅ Automatic recovery from API failures

---

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

---

## Solution Architecture

The implementation uses a hybrid approach combining server-side rendering, request deduplication, rate limiting, and circuit breaker patterns.

### Components

#### 1. Circuit Breaker (`src/lib/circuit-breaker.ts`)

Implements the Circuit Breaker pattern to prevent cascading failures:

```
CLOSED → OPEN → HALF_OPEN → CLOSED
   ↑                           ↓
   └───────── (recovery) ──────┘
```

**States:**
- **CLOSED**: Normal operation - all requests go through
- **OPEN**: API is down, fail fast for 60 seconds
- **HALF_OPEN**: Testing recovery with 2 test requests

**Configuration:**
- Opens after 3 consecutive failures
- Stays open for 60 seconds
- Tests with 2 requests before closing

#### 2. Batch Fetcher (`src/lib/ezygo-batch-fetcher.ts`)

Three-layer protection system:

**Layer 1: Request Deduplication (LRU Cache)**
- 60-second TTL cache
- Stores in-flight promises and resolved results
- Multiple requests from the same user/token share cached response
- Prevents duplicate concurrent requests

**Layer 2: Rate Limiting**
- Max 3 concurrent requests (configurable via `MAX_CONCURRENT`)
- Automatic queuing for excess requests
- Fair distribution via FIFO queue
- Customizable per deployment needs

**Layer 3: Circuit Breaker Integration**
- Wraps all requests
- Automatic fail-fast when API is down
- Prevents wasted resources
- Automatic recovery testing

#### 3. Server Components (`src/app/(protected)/dashboard/page.tsx`)

Server-side rendering with:
- Authentication check on the server
- Token validation before fetching
- Pre-fetch dashboard data
- Pass initial data to client component for React Query hydration

#### 4. Client Component (`src/app/(protected)/dashboard/DashboardClient.tsx`)

Client-side hydration:
- Receives initial data from SSR
- Hydrates React Query cache with initial data
- Maintains existing functionality
- Falls back to client fetch if SSR fails

---

## Performance Analysis

### Concurrent User Scenario

**20 users hit /dashboard simultaneously:**

| Metric | Before Optimization | After Optimization |
|--------|---------------------|-------------------|
| Peak concurrent requests | 120 | 3 |
| First user load time | ~2s | ~2s (same) |
| 20th user load time | ~2s | ~6s (queued) |
| Rate limit risk | High 🔴 | Low 🟢 |
| Circuit breaker protection | None | Full |

**Result (with MAX_CONCURRENT = 3):**
- ✅ Significantly reduces risk of rate limiting
- ✅ Maintains fast UX for early users
- ✅ Graceful queueing for later users
- ✅ Automatic recovery from API issues

### Request Flow

```
User Request
    ↓
Check Cache (Layer 1)
    ├─ HIT → Return cached data (instant)
    └─ MISS ↓
Check Rate Limit (Layer 2)
    ├─ ALLOWED → Proceed
    └─ THROTTLED → Queue request
        ↓
Circuit Breaker (Layer 3)
    ├─ CLOSED → Make API call
    ├─ OPEN → Fail fast with error
    └─ HALF_OPEN → Test with limited requests
        ↓
EzyGo API
```

---

## Using the Batch Fetcher

### Fetching Dashboard Data

```typescript
import { fetchDashboardData } from '@/lib/ezygo-batch-fetcher';

// Server component (SSR)
const data = await fetchDashboardData(accessToken);
// Returns: { courses, attendance }
```

### Individual API Calls

```typescript
import { circuitBreaker } from '@/lib/circuit-breaker';
import axios from '@/lib/axios';

// Wrap individual calls with circuit breaker
const response = await circuitBreaker.execute(async () => {
  return axios.get('/myprofile', {
    headers: { Authorization: `Bearer ${token}` }
  });
});
```

### Monitoring

Circuit breaker provides state monitoring:

```typescript
import { circuitBreaker } from '@/lib/circuit-breaker';

// Check circuit state
console.log('Circuit state:', circuitBreaker.getState());
// Output: 'CLOSED' | 'OPEN' | 'HALF_OPEN'

// Get failure count
console.log('Failures:', circuitBreaker['failureCount']);

// Get last failure time
console.log('Last failure:', circuitBreaker['lastFailureTime']);
```

---

## Implementation Coverage

### ✅ Server-Side Calls (Direct to EzyGo)

**Dashboard Page** (`src/app/(protected)/dashboard/page.tsx`):
- Uses `fetchDashboardData()` with full protection
- Fetches: `/institutionuser/courses/withusers`, `/attendancereports/student/detailed`
- ✅ Request deduplication
- ✅ Circuit breaker protection
- ✅ Rate limited to 3 concurrent requests

### ✅ Client-Side Calls (Via API Proxy)

All client-side hooks use `axios` which routes through `/api/backend/*` proxy:

**Authentication Endpoints**:
- `login`, `save-token`
- ✅ Circuit breaker protection in proxy
- ✅ NOT rate-limited (login is critical path)
- ✅ Origin validation prevents abuse

**Profile Hook** (`src/hooks/users/profile.ts`):
- Calls `/myprofile` via axios
- ✅ Circuit breaker protection in proxy

**User Hook** (`src/hooks/users/user.ts`):
- Calls `/user` via axios
- ✅ Circuit breaker protection in proxy

**Courses Hook** (`src/hooks/courses/courses.ts`):
- Calls `/institutionuser/courses/withusers` via axios
- ✅ Circuit breaker protection in proxy
- ✅ Accepts `initialData` from SSR

**Attendance Hook** (`src/hooks/courses/attendance.ts`):
- Calls `/attendancereports/student/detailed` via axios
- ✅ Circuit breaker protection in proxy
- ✅ Accepts `initialData` from SSR

### ⚠️ Cron/Background Jobs

**Sync Cron** (`src/app/api/cron/sync/route.ts`):
- Direct calls to EzyGo API
- ⚠️ **NOT rate-limited** (runs infrequently, separate from user traffic)
- Consider: Add rate limiting if frequency increases

---

## Configuration

### Tuning Rate Limits

Adjust the `MAX_CONCURRENT` constant in `src/lib/ezygo-batch-fetcher.ts`:

```typescript
const MAX_CONCURRENT = 3; // Default: 3 concurrent requests

// For higher capacity deployments:
const MAX_CONCURRENT = 5; // Allow more concurrent requests

// For conservative rate limiting:
const MAX_CONCURRENT = 2; // Stricter rate limiting
```

### Circuit Breaker Settings

Modify thresholds in `src/lib/circuit-breaker.ts`:

```typescript
export class CircuitBreaker {
  private failureThreshold = 3;    // Open after 3 failures
  private resetTimeout = 60000;    // Stay open for 60 seconds
  private halfOpenRequests = 2;    // Test with 2 requests
}
```

### Cache TTL

Adjust cache duration in `src/lib/ezygo-batch-fetcher.ts`:

```typescript
const CACHE_TTL = 60 * 1000; // 60 seconds

// For longer caching:
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// For shorter caching:
const CACHE_TTL = 30 * 1000; // 30 seconds
```

---

## Optimization for Single-IP Deployment

For deployments where all users share a single public IP (common in institutional networks, NATs, or proxies), consider:

### Recommendation: Increase MAX_CONCURRENT

Single-IP deployments can handle more concurrent requests without triggering rate limits:

```typescript
// Default (conservative)
const MAX_CONCURRENT = 3;

// For single-IP deployment (recommended)
const MAX_CONCURRENT = 10;

// For high-traffic single-IP
const MAX_CONCURRENT = 15;
```

**Why this works:**
- EzyGo rate limiting is often per-IP, not per-user
- Single IP = effectively one "client" from EzyGo's perspective
- In-flight request deduplication still protects against duplicate requests
- Higher throughput for concurrent users on the same IP

### Testing Your Deployment

1. **Monitor circuit breaker state:**
   ```typescript
   import { circuitBreaker } from '@/lib/circuit-breaker';
   console.log('State:', circuitBreaker.getState());
   ```

2. **Check for rate limit errors:**
   - Monitor Sentry for 429 (Too Many Requests) errors
   - Watch for circuit breaker opening frequently

3. **Adjust based on observations:**
   - If circuit opens rarely: Increase `MAX_CONCURRENT`
   - If circuit opens frequently: Keep conservative limit
   - If users experience slow response: Increase limit slightly

### Edge Cases Handled

**Issue: User Refreshes Dashboard Rapidly**
- ✅ Request deduplication prevents duplicate in-flight requests
- ✅ Cache returns cached data for subsequent requests within TTL

**Issue: 100 Users Hit Dashboard Simultaneously**
- ✅ Rate limiter queues excess requests
- ✅ First 3 (or MAX_CONCURRENT) users get immediate response
- ✅ Remaining users wait in queue, served as slots free up

**Issue: EzyGo API Goes Down Mid-Request**
- ✅ Circuit breaker opens after 3 failures
- ✅ Fail-fast for 60 seconds
- ✅ Automatic recovery testing after cooldown

**Issue: Different Users, Same Data Request**
- ✅ Each user has separate token
- ✅ Cache is per-token (user-specific data)
- ✅ No cross-user data leakage

**Issue: Login During Circuit Open**
- ✅ Login endpoint bypasses rate limiter
- ✅ Circuit breaker applied but with separate failure tracking

---

## Best Practices

1. **Monitor circuit breaker state** in production
2. **Tune MAX_CONCURRENT** based on your deployment type
3. **Enable Sentry** for rate limit error tracking
4. **Use SSR** for dashboard pages when possible
5. **Test with realistic concurrent user load**
6. **Document any configuration changes**

---

## Troubleshooting

**Problem: Circuit breaker opens frequently**
- Check EzyGo API status
- Verify network connectivity
- Review error logs in Sentry
- Consider increasing failure threshold

**Problem: Users experience slow response times**
- Increase `MAX_CONCURRENT` if rate limits allow
- Check cache hit rate
- Verify SSR is working properly

**Problem: 429 Rate Limit errors**
- Decrease `MAX_CONCURRENT`
- Increase cache TTL
- Review request patterns in logs

**Problem: Stale data displayed**
- Reduce cache TTL
- Implement cache invalidation on user actions
- Use React Query refetch strategies

---

For implementation details and code examples, see:
- `src/lib/circuit-breaker.ts`
- `src/lib/ezygo-batch-fetcher.ts`
- `src/app/(protected)/dashboard/page.tsx`
