/**
 * Tests for CSRF API Route
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "../route";

// Mock the CSRF module
vi.mock("@/lib/security/csrf", () => ({
  initializeCsrfToken: vi.fn(),
  getCsrfToken: vi.fn(),
}));

describe("CSRF API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/csrf", () => {
    it("should return CSRF token successfully", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const mockToken = "test-csrf-token-123";
      vi.mocked(initializeCsrfToken).mockResolvedValue(mockToken);

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
      vi.mocked(initializeCsrfToken).mockResolvedValue("token");

      const response = await GET();
      
      expect(response.headers.get("Cache-Control")).toBe(
        "no-store, no-cache, must-revalidate"
      );
    });

    it("should handle initialization errors", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const error = new Error("Token initialization failed");
      vi.mocked(initializeCsrfToken).mockRejectedValue(error);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: "Failed to initialize CSRF token",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "CSRF token initialization error:",
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle unexpected errors gracefully", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      vi.mocked(initializeCsrfToken).mockRejectedValue("Unexpected error");

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await GET();
      
      expect(response.status).toBe(500);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("POST /api/csrf", () => {
    it("should refresh CSRF token successfully", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const mockToken = "refreshed-token-456";
      vi.mocked(initializeCsrfToken).mockResolvedValue(mockToken);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        token: mockToken,
        message: "CSRF token refreshed successfully",
      });
      expect(initializeCsrfToken).toHaveBeenCalledOnce();
    });

    it("should handle refresh errors", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const error = new Error("Token refresh failed");
      vi.mocked(initializeCsrfToken).mockRejectedValue(error);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: "Failed to refresh CSRF token",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "CSRF token refresh error:",
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return different tokens on multiple calls", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      
      vi.mocked(initializeCsrfToken)
        .mockResolvedValueOnce("token-1")
        .mockResolvedValueOnce("token-2");

      const response1 = await POST();
      const data1 = await response1.json();
      
      const response2 = await POST();
      const data2 = await response2.json();

      expect(data1.token).toBe("token-1");
      expect(data2.token).toBe("token-2");
      expect(initializeCsrfToken).toHaveBeenCalledTimes(2);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle rapid successive requests", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      vi.mocked(initializeCsrfToken).mockResolvedValue("token");

      const promises = [GET(), GET(), GET()];
      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(3);
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it("should work correctly when token already exists", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const existingToken = "existing-token";
      vi.mocked(initializeCsrfToken).mockResolvedValue(existingToken);

      const response = await GET();
      const data = await response.json();

      expect(data.token).toBe(existingToken);
    });
  });

  describe("Security properties", () => {
    it("should not expose sensitive error details", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      const sensitiveError = new Error("Database password: secret123");
      vi.mocked(initializeCsrfToken).mockRejectedValue(sensitiveError);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await GET();
      const data = await response.json();

      // Error message should be generic
      expect(data.error).toBe("Failed to initialize CSRF token");
      // Should not contain sensitive information
      expect(JSON.stringify(data)).not.toContain("secret123");

      consoleErrorSpy.mockRestore();
    });

    it("should return proper HTTP status codes", async () => {
      const { initializeCsrfToken } = await import("@/lib/security/csrf");
      
      // Success case
      vi.mocked(initializeCsrfToken).mockResolvedValue("token");
      let response = await GET();
      expect(response.status).toBe(200);

      // Error case
      vi.mocked(initializeCsrfToken).mockRejectedValue(new Error("error"));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      response = await GET();
      expect(response.status).toBe(500);
      consoleErrorSpy.mockRestore();
    });
  });
});
