/**
 * Tests for CSRF Init API Route
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";

// Mock the CSRF module
vi.mock("@/lib/security/csrf", () => ({
  initializeCsrfToken: vi.fn(),
}));

// Mock rate limiter
vi.mock("@/lib/ratelimit", () => ({
  authRateLimiter: {
    limit: vi.fn(),
  },
}));

// Mock utils
vi.mock("@/lib/utils", () => ({
  getClientIp: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: (key: string) => {
      if (key === "x-forwarded-for") return "127.0.0.1";
      if (key === "cf-connecting-ip") return null;
      if (key === "x-real-ip") return null;
      return null;
    },
  })),
}));

describe("CSRF Init API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/csrf/init", () => {
    it("should initialize and return CSRF token successfully", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const { authRateLimiter } = await import("@/lib/ratelimit");
      const { getClientIp } = await import("@/lib/utils");
      
      const mockToken = "test-csrf-token-init-123";
      vi.mocked(initializeCsrfToken).mockResolvedValue(mockToken);
      vi.mocked(authRateLimiter.limit).mockResolvedValue({ 
        success: true,
        limit: 10,
        reset: 60,
        remaining: 9
      } as any);
      vi.mocked(getClientIp).mockReturnValue("127.0.0.1");

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        token: mockToken,
        message: "CSRF token initialized successfully",
      });
      expect(initializeCsrfToken).toHaveBeenCalledOnce();
    });

    it("should have no-cache headers", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const { authRateLimiter } = await import("@/lib/ratelimit");
      const { getClientIp } = await import("@/lib/utils");
      
      vi.mocked(initializeCsrfToken).mockResolvedValue("token");
      vi.mocked(authRateLimiter.limit).mockResolvedValue({ success: true } as any);
      vi.mocked(getClientIp).mockReturnValue("127.0.0.1");

      const response = await GET();
      
      expect(response.headers.get("Cache-Control")).toBe(
        "no-store, max-age=0"
      );
    });

    it("should enforce rate limiting", async () => {
      const { authRateLimiter } = await import("@/lib/ratelimit");
      const { getClientIp } = await import("@/lib/utils");
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      
      vi.mocked(authRateLimiter.limit).mockResolvedValue({ 
        success: false,
        limit: 10,
        reset: 60,
        remaining: 0
      } as any);
      vi.mocked(getClientIp).mockReturnValue("127.0.0.1");

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain("Too many CSRF initialization requests");
      expect(data.retryAfter).toBe(60);
      
      // Verify rate limit headers are set
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("X-RateLimit-Reset")).toBe("60");
      
      // Verify token initialization is not called when rate limited
      expect(initializeCsrfToken).not.toHaveBeenCalled();
    });

    it("should handle initialization errors", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const { authRateLimiter } = await import("@/lib/ratelimit");
      const { getClientIp } = await import("@/lib/utils");
      const { logger } = await import("@/lib/logger");
      const Sentry = await import("@sentry/nextjs");
      
      const error = new Error("Token initialization failed");
      vi.mocked(initializeCsrfToken).mockRejectedValue(error);
      vi.mocked(authRateLimiter.limit).mockResolvedValue({ success: true } as any);
      vi.mocked(getClientIp).mockReturnValue("127.0.0.1");

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: "Failed to initialize CSRF token",
      });
      
      // Verify error logging
      expect(logger.error).toHaveBeenCalledWith(
        "CSRF token initialization error:",
        "Token initialization failed"
      );
      
      // Verify Sentry capture
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            type: "csrf_init_error",
            location: "csrf_init_route"
          })
        })
      );
    });

    it("should continue when IP cannot be determined", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const { getClientIp } = await import("@/lib/utils");
      const { logger } = await import("@/lib/logger");
      
      const mockToken = "token-no-ip";
      vi.mocked(initializeCsrfToken).mockResolvedValue(mockToken);
      vi.mocked(getClientIp).mockReturnValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBe(mockToken);
      
      // Verify warning is logged
      expect(logger.warn).toHaveBeenCalledWith(
        "Unable to determine client IP for CSRF init rate limiting"
      );
    });

    it("should work correctly when token already exists", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const { authRateLimiter } = await import("@/lib/ratelimit");
      const { getClientIp } = await import("@/lib/utils");
      
      const existingToken = "existing-init-token";
      vi.mocked(initializeCsrfToken).mockResolvedValue(existingToken);
      vi.mocked(authRateLimiter.limit).mockResolvedValue({ success: true } as any);
      vi.mocked(getClientIp).mockReturnValue("127.0.0.1");

      const response = await GET();
      const data = await response.json();

      expect(data.token).toBe(existingToken);
      expect(response.status).toBe(200);
    });

    it("should use separate rate limit key from regenerate endpoint", async () => {
      const { authRateLimiter } = await import("@/lib/ratelimit");
      const { getClientIp } = await import("@/lib/utils");
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      
      vi.mocked(authRateLimiter.limit).mockResolvedValue({ success: true } as any);
      vi.mocked(getClientIp).mockReturnValue("192.168.1.100");
      vi.mocked(initializeCsrfToken).mockResolvedValue("token");

      await GET();

      // Verify the rate limit key includes "csrf_init_" prefix and the IP
      expect(authRateLimiter.limit).toHaveBeenCalledWith("csrf_init_192.168.1.100");
    });
  });

  describe("Security properties", () => {
    it("should not expose sensitive error details", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const { authRateLimiter } = await import("@/lib/ratelimit");
      const { getClientIp } = await import("@/lib/utils");
      
      const sensitiveError = new Error("Database password: secret123");
      vi.mocked(initializeCsrfToken).mockRejectedValue(sensitiveError);
      vi.mocked(authRateLimiter.limit).mockResolvedValue({ success: true } as any);
      vi.mocked(getClientIp).mockReturnValue("127.0.0.1");

      const response = await GET();
      const data = await response.json();

      // Error message should be generic
      expect(data.error).toBe("Failed to initialize CSRF token");
      // Should not contain sensitive information
      expect(JSON.stringify(data)).not.toContain("secret123");
    });

    it("should return proper HTTP status codes", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const { authRateLimiter } = await import("@/lib/ratelimit");
      const { getClientIp } = await import("@/lib/utils");
      
      // Success case
      vi.mocked(initializeCsrfToken).mockResolvedValue("token");
      vi.mocked(authRateLimiter.limit).mockResolvedValue({ success: true } as any);
      vi.mocked(getClientIp).mockReturnValue("127.0.0.1");
      
      let response = await GET();
      expect(response.status).toBe(200);

      // Rate limit case
      vi.mocked(authRateLimiter.limit).mockResolvedValue({ 
        success: false,
        limit: 10,
        reset: 60,
        remaining: 0
      } as any);
      response = await GET();
      expect(response.status).toBe(429);

      // Error case
      vi.mocked(authRateLimiter.limit).mockResolvedValue({ success: true } as any);
      vi.mocked(initializeCsrfToken).mockRejectedValue(new Error("error"));
      response = await GET();
      expect(response.status).toBe(500);
    });
  });
});
