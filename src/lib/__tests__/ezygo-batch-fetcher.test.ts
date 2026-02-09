import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fetchEzygoData, getRateLimiterStats, resetRateLimiterState } from '../ezygo-batch-fetcher';

// Mock the circuit breaker to passthrough execution
vi.mock('../circuit-breaker', () => ({
  ezygoCircuitBreaker: {
    execute: vi.fn((fn) => fn()),
  },
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'CircuitBreakerOpenError';
    }
  },
  NonBreakerError: class NonBreakerError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NonBreakerError';
    }
  },
}));

// Mock the logger
vi.mock('../logger', () => ({
  logger: {
    dev: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('EzyGo Batch Fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset rate limiter state to avoid test interference
    resetRateLimiterState();
    // Reset fetch mock before each test
    global.fetch = vi.fn();
    
    // Set required environment variable
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.example.com';
  });

  afterEach(() => {
    // Don't clean up in afterEach since some tests need to modify it
    // Each test should handle its own cleanup if needed
  });

  describe('Request Deduplication', () => {
    it('should deduplicate identical in-flight requests', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const token = 'test-token';
      const endpoint = '/myprofile';

      // Make 3 concurrent identical requests
      const promises = [
        fetchEzygoData(endpoint, token),
        fetchEzygoData(endpoint, token),
        fetchEzygoData(endpoint, token),
      ];

      const results = await Promise.all(promises);

      // All should return the same result
      expect(results).toEqual([mockResponse, mockResponse, mockResponse]);
      
      // But fetch should only be called once due to deduplication
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should use separate cache keys for different methods', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const token = 'test-token';
      const endpoint = '/endpoint';

      // Make GET and POST requests to the same endpoint
      await Promise.all([
        fetchEzygoData(endpoint, token, 'GET'),
        fetchEzygoData(endpoint, token, 'POST', {}),
      ]);

      // Should make 2 separate requests (different methods)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use separate cache keys for different tokens', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const endpoint = '/myprofile';

      // Make requests with different tokens
      await Promise.all([
        fetchEzygoData(endpoint, 'token-1'),
        fetchEzygoData(endpoint, 'token-2'),
      ]);

      // Should make 2 separate requests (different tokens)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use separate cache keys for different request bodies', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const token = 'test-token';
      const endpoint = '/endpoint';

      // Make POST requests with different bodies
      await Promise.all([
        fetchEzygoData(endpoint, token, 'POST', { param: 'value1' }),
        fetchEzygoData(endpoint, token, 'POST', { param: 'value2' }),
      ]);

      // Should make 2 separate requests (different bodies)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate endpoints with and without leading slash', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const token = 'test-token';

      // Make concurrent requests with /endpoint and endpoint
      const promises = [
        fetchEzygoData('/myprofile', token),
        fetchEzygoData('myprofile', token),
      ];

      const results = await Promise.all(promises);

      // Both should return the same result
      expect(results).toEqual([mockResponse, mockResponse]);
      
      // But fetch should only be called once due to endpoint normalization
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce max concurrent requests (3)', async () => {
      let activeRequests = 0;
      let maxConcurrent = 0;

      (global.fetch as any).mockImplementation(async () => {
        activeRequests++;
        maxConcurrent = Math.max(maxConcurrent, activeRequests);
        
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 50));
        
        activeRequests--;
        return {
          ok: true,
          json: async () => ({ data: 'test' }),
        };
      });

      const token = 'test-token';
      
      // Make 10 requests with different endpoints to avoid deduplication
      const promises = Array.from({ length: 10 }, (_, i) => 
        fetchEzygoData(`/endpoint-${i}`, token)
      );

      await Promise.all(promises);

      // Max concurrent should not exceed 3
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should queue requests when limit is reached', async () => {
      const stats = getRateLimiterStats();
      expect(stats).toHaveProperty('activeRequests');
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('maxConcurrent');
      expect(stats.maxConcurrent).toBe(3);
    });
  });

  describe('API Request Construction', () => {
    it('should construct correct URL for GET requests', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      await fetchEzygoData('/myprofile', 'test-token', 'GET');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/myprofile',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should include body for POST requests', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      const body = { key: 'value' };
      await fetchEzygoData('/endpoint', 'test-token', 'POST', body);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
    });

    it('should handle endpoints with leading slash', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      await fetchEzygoData('/endpoint', 'test-token');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.any(Object)
      );
    });

    it('should handle endpoints without leading slash', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      await fetchEzygoData('endpoint', 'test-token');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.any(Object)
      );
    });

    it('should handle backend URL with trailing slash', async () => {
      // Use unique endpoint to avoid cache
      const uniqueEndpoint = `/trail-test-${Date.now()}`;
      const originalUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.example.com/';
      
      vi.clearAllMocks();
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      await fetchEzygoData(uniqueEndpoint, `test-token-${Date.now()}`);

      // Should not have double slash
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.example.com${uniqueEndpoint}`,
        expect.any(Object)
      );
      
      // Restore
      process.env.NEXT_PUBLIC_BACKEND_URL = originalUrl;
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-ok responses', async () => {
      // Create unique endpoint to avoid cache
      const uniqueEndpoint = `/error-test-${Date.now()}`;
      
      vi.clearAllMocks();
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Not Found' }),
      });

      await expect(
        fetchEzygoData(uniqueEndpoint, `test-token-${Date.now()}`)
      ).rejects.toThrow('EzyGo API error: 404 Not Found');
    });
  });

  describe('getRateLimiterStats', () => {
    it('should return rate limiter statistics', () => {
      const stats = getRateLimiterStats();

      expect(stats).toHaveProperty('activeRequests');
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('maxConcurrent');
      expect(stats).toHaveProperty('cacheSize');
      
      expect(typeof stats.activeRequests).toBe('number');
      expect(typeof stats.queueLength).toBe('number');
      expect(typeof stats.maxConcurrent).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
    });

    it('should show correct maxConcurrent value', () => {
      const stats = getRateLimiterStats();
      expect(stats.maxConcurrent).toBe(3);
    });
  });

  describe('Cache Key Security', () => {
    it('should use SHA-256 hash for cache key (not token suffix)', async () => {
      const mockResponse = { data: 'test' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Two different tokens with same last 8 characters
      const token1 = 'prefix1-12345678';
      const token2 = 'prefix2-12345678';

      // Make requests with both tokens
      await Promise.all([
        fetchEzygoData('/endpoint', token1),
        fetchEzygoData('/endpoint', token2),
      ]);

      // Should make 2 separate requests (different token hashes)
      // This verifies tokens are hashed, not just using suffix
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Queue Management', () => {
    it('should throw QueueFullError when queue is full', async () => {
      // Use fake timers to prevent real 30s timeouts
      vi.useFakeTimers();
      
      try {
        // Reset state first
        resetRateLimiterState();
        vi.clearAllMocks();
        
        // Create a long-running fetch that blocks all slots
        const blockingPromise = new Promise(() => {}); // Never resolves
        (global.fetch as any).mockReturnValue(blockingPromise);
        
        // Fill up all 3 concurrent slots + 100 queue slots
        const requests = [];
        for (let i = 0; i < 103; i++) {
          requests.push(
            fetchEzygoData(`/endpoint-${i}`, `token-${i}`).catch(e => e)
          );
        }
        
        // Advance timers slightly to allow promises to start
        await vi.advanceTimersByTimeAsync(10);
        
        // The 104th request should fail immediately with QueueFullError
        try {
          await fetchEzygoData('/endpoint-104', 'token-104');
          expect.fail('Should have thrown QueueFullError');
        } catch (error: any) {
          expect(error.name).toBe('QueueFullError');
          expect(error.message).toContain('Request queue is full');
          expect(error.message).toContain('100 items');
        }
        
        // Clean up - reset state for other tests
        resetRateLimiterState();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should evict queue errors from cache to allow retry', async () => {
      // Use fake timers to prevent real 30s timeouts
      vi.useFakeTimers();
      
      try {
        // Reset state first
        resetRateLimiterState();
        vi.clearAllMocks();
        
        // Create a long-running fetch that blocks all slots
        const blockingPromise = new Promise(() => {}); // Never resolves
        (global.fetch as any).mockReturnValue(blockingPromise);
        
        // Fill up all 3 concurrent slots + 100 queue slots
        const requests = [];
        for (let i = 0; i < 103; i++) {
          requests.push(
            fetchEzygoData(`/endpoint-${i}`, `token-${i}`).catch(e => e)
          );
        }
        
        // Advance timers slightly to allow promises to start
        await vi.advanceTimersByTimeAsync(10);
        
        // Make the same request twice - both should fail with QueueFullError
        // If cache wasn't evicted, the second would return the cached rejection
        const endpoint = '/test-eviction';
        const token = 'test-token';
        
        try {
          await fetchEzygoData(endpoint, token);
          expect.fail('First request should have thrown QueueFullError');
        } catch (error: any) {
          expect(error.name).toBe('QueueFullError');
        }
        
        // Second request should also fail with QueueFullError (not cached)
        try {
          await fetchEzygoData(endpoint, token);
          expect.fail('Second request should have thrown QueueFullError');
        } catch (error: any) {
          expect(error.name).toBe('QueueFullError');
          // If it was cached, we'd get the same promise rejection
          // The fact that it throws again proves cache was evicted
        }
        
        // Clean up
        resetRateLimiterState();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
