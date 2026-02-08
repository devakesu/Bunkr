# Edge Case Analysis & Test Scenarios for EzyGo Rate Limiting

This file documents edge cases and provides test scenarios to verify the rate limiting implementation works correctly.

## Edge Case 1: User Refreshes Dashboard Rapidly

**Scenario:** User hits F5 multiple times in quick succession

**Expected Behavior:**
- First request: Triggers API calls
- Subsequent requests (within 15s): Share in-flight promises
- Result: Only 3 API calls total, not 9 (3 per refresh)

**Implementation:**
- LRU cache with 15s TTL deduplicates requests
- Cache key includes token + endpoint + body
- Same user = same cache key = shared request

## Edge Case 2: 100 Users Hit Dashboard Simultaneously

**Scenario:** Traffic spike - 100 concurrent users

**Expected Behavior:**
- Max 3 concurrent API calls at any time
- Queue forms automatically
- All users eventually get data
- No 429 (Rate Limit) errors from EzyGo

**Timeline:**
- Users 1-3: Immediate
- Users 4-100: Queued (FIFO)
- Last user: ~60-70s wait (worst case)

**Risk Mitigation:**
- Request deduplication reduces actual API calls
- Circuit breaker prevents retry storms
- Conservative MAX_CONCURRENT = 3

## Edge Case 3: EzyGo API Goes Down Mid-Request

**Scenario:** API fails during active requests

**Expected Behavior:**
- First 3 failures: Circuit remains CLOSED
- 4th failure: Circuit OPENS
- Subsequent requests: Fail fast (503 error)
- After 60s: Circuit transitions to HALF_OPEN
- 2 test requests: If successful, circuit CLOSES

**User Experience:**
- First users: See error after timeout
- Queued users: Fail fast (don't wait for timeout)
- Clear error message: "Service temporarily unavailable"

## Edge Case 4: Different Users, Same Data Request

**Scenario:** Multiple users need same public data

**Cache Key Structure:** `${token}:${endpoint}:${body}`

Different users = Different tokens = Different cache keys
Result: NO deduplication across users

**Reasoning:**
- User data is personalized
- Can't share responses across users (security)
- Rate limiting still applies (max 3 concurrent)

## Edge Case 5: Login During Circuit Open

**Scenario:** User tries to login while circuit is OPEN

**Flow:**
1. User submits login
2. Client → /api/backend/login → Proxy
3. Proxy wraps in circuit breaker
4. Circuit is OPEN → Fails fast
5. User sees: "Service temporarily unavailable"

**Expected Behavior:**
- Login fails gracefully
- Clear error message
- No infinite loading spinner
- User can retry after 60s

## Edge Case 6: Dashboard SSR vs Client Fetch Race

**Scenario:** SSR provides initialData, but React Query also fetches

**Flow:**
1. Server fetches data → initialData
2. Client hydrates with initialData
3. React Query sees initialData → Uses it
4. After staleTime (30s) → Background refetch

**Expected Behavior:**
- No duplicate requests on page load
- initialData prevents immediate client fetch
- Background refetch happens after 30s
- Uses rate limiter for background fetches

## Edge Case 7: Token Expires Mid-Request

**Scenario:** Token expires while request is in-flight

**Expected Behavior:**
- EzyGo returns 401 Unauthorized
- Circuit breaker sees this as failure
- After 3 failures → Circuit OPENS
- User gets logged out (existing auth logic)

**Risk:**
- Expired token counted as API failure
- Could open circuit unnecessarily

**Mitigation:**
- Token refresh mechanism should prevent this
- Auth errors handled separately from API errors

## Edge Case 8: Slow Network + Timeout

**Scenario:** Request takes > 15s (timeout)

**Expected Behavior:**
- AbortController triggers at 15s
- Request aborted
- Slot released
- Queue processes next request
- Circuit breaker counts as failure

After 3 timeouts → Circuit OPENS

## Edge Case 9: Memory Leak from Cache

**Scenario:** Cache grows too large

**Prevention:**
- LRU cache max = 500 entries
- Each entry = promise reference (small)
- TTL = 15s (auto cleanup)
- updateAgeOnGet = false (strict expiry)

**Memory Usage:**
- ~500 entries × ~100 bytes = ~50KB
- Negligible memory footprint

## Edge Case 10: Multiple Server Instances

**Scenario:** App deployed with multiple servers

**Current Implementation:**
- Rate limiter is per-instance (in-memory)
- Cache is per-instance (in-memory)
- Each server = 3 concurrent requests

**With 5 servers:**
- Total concurrent = 5 × 3 = 15 requests

**Risk:**
- More aggressive than single-IP (current setup)
- May need to reduce MAX_CONCURRENT

**Solution:**
- For multi-instance: Reduce to MAX_CONCURRENT = 2
- Or implement Redis-based rate limiting

---

## Test Scenarios

### Test 1: Rate Limiter Basic Flow

**Setup:**
- MAX_CONCURRENT = 3
- Send 10 requests simultaneously

**Assertions:**
- Max 3 active requests at any time
- Queue length = 7 initially
- All 10 requests eventually complete
- Order preserved (FIFO)

### Test 2: Request Deduplication

**Setup:**
- Same token, same endpoint, same body
- Send 5 identical requests

**Assertions:**
- Only 1 API call made
- All 5 callers get same response
- Cache hit = 4/5 = 80%

### Test 3: Circuit Breaker Opening

**Setup:**
- Mock EzyGo API to return errors
- Send 5 requests

**Assertions:**
- First 3 requests: Fail after timeout
- Circuit state = CLOSED → OPEN
- 4th & 5th requests: Fail fast (no timeout)
- Error message: "Circuit breaker is open"

### Test 4: Circuit Breaker Recovery

**Setup:**
- Open circuit
- Wait 60s
- Mock API to return success
- Send 3 requests

**Assertions:**
- Circuit state = OPEN → HALF_OPEN
- First 2 requests succeed
- Circuit state = HALF_OPEN → CLOSED
- 3rd request succeeds normally

### Test 5: Login During Outage

**Setup:**
- Open circuit breaker
- Attempt login

**Assertions:**
- Login fails fast
- User sees error message
- No token stored
- User remains on login page

### Test 6: Dashboard Load with initialData

**Setup:**
- SSR fetches initialData
- Pass to DashboardClient

**Assertions:**
- No immediate client fetch
- React Query uses initialData
- isLoading = false immediately
- Background refetch after 30s

### Test 7: Concurrent Dashboard Loads

**Setup:**
- 20 users load dashboard within 1 second

**Assertions:**
- Max 3 concurrent API calls
- First user: ~2s load time
- Last user: ~12s load time
- No rate limit errors
- All users get data

### Test 8: Health Check Endpoint

**Setup:**
- Call GET /api/health/ezygo

**Assertions:**
- Response includes rate limiter stats
- Response includes circuit breaker state
- Status 200 when healthy
- Status 503 when circuit open

---

## Monitoring Checklist

### Metrics to Track

**1. Rate Limiter:**
- activeRequests (should stay ≤ 3)
- queueLength (alert if > 15 sustained)
- cacheSize (should fluctuate 0-50)

**2. Circuit Breaker:**
- state (CLOSED normal, alert if OPEN)
- failures (track patterns)
- openings per hour (should be 0)

**3. API Performance:**
- Request duration (p50, p95, p99)
- Error rate
- Timeout rate

**4. User Experience:**
- Dashboard load time
- Login success rate
- Error messages displayed

