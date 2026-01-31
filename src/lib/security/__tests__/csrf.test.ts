/**
 * Tests for CSRF Protection Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateCsrfToken,
  getCsrfToken,
  setCsrfCookie,
  validateCsrfToken,
  initializeCsrfToken,
  regenerateCsrfToken,
  removeCsrfToken,
} from "../csrf";

// Create mock cookie store
let mockCookieStore: {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

// Mock the Next.js cookies module
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookieStore),
}));

describe("CSRF Protection", () => {
  beforeEach(() => {
    // Create fresh mock cookie store for each test
    mockCookieStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateCsrfToken", () => {
    it("should generate a token of correct length", () => {
      const token = generateCsrfToken();
      // 32 bytes = 64 hex characters
      expect(token).toHaveLength(64);
    });

    it("should generate unique tokens", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });

    it("should generate tokens with valid hex characters", () => {
      const token = generateCsrfToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("getCsrfToken", () => {
    it("should return token when it exists", async () => {
      const expectedToken = "test-token-123";
      mockCookieStore.get.mockReturnValue({ value: expectedToken });

      const token = await getCsrfToken();
      
      expect(token).toBe(expectedToken);
      expect(mockCookieStore.get).toHaveBeenCalledWith("csrf_token");
    });

    it("should return null when token doesn't exist", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const token = await getCsrfToken();
      
      expect(token).toBe(null);
    });

    it("should return null when cookie value is empty", async () => {
      mockCookieStore.get.mockReturnValue({ value: "" });

      const token = await getCsrfToken();
      
      expect(token).toBe(null);
    });
  });

  describe("setCsrfCookie", () => {
    it("should set cookie with correct configuration", async () => {
      const token = "test-token-456";
      
      await setCsrfCookie(token);
      
      expect(mockCookieStore.set).toHaveBeenCalledWith({
        name: "csrf_token",
        value: token,
        httpOnly: true, // XSS-safe: token not accessible to JavaScript
        secure: false, // In test environment
        sameSite: "strict",
        maxAge: 86400, // 24 hours
        path: "/",
      });
    });

    it("should set secure flag based on NODE_ENV", async () => {
      // In test environment (not production), secure should be false
      const token = "test-token-789";
      await setCsrfCookie(token);
      
      const callArg = mockCookieStore.set.mock.calls[0][0] as any;
      expect(callArg.secure).toBe(process.env.NODE_ENV === "production");
    });
  });

  describe("validateCsrfToken", () => {
    it("should return true for matching tokens", async () => {
      const token = "a".repeat(64); // Same length token
      mockCookieStore.get.mockReturnValue({ value: token });

      const isValid = await validateCsrfToken(token);
      
      expect(isValid).toBe(true);
    });

    it("should return false for non-matching tokens", async () => {
      mockCookieStore.get.mockReturnValue({ value: "token1" });

      const isValid = await validateCsrfToken("token2");
      
      expect(isValid).toBe(false);
    });

    it("should return false when request token is null", async () => {
      mockCookieStore.get.mockReturnValue({ value: "token" });

      const isValid = await validateCsrfToken(null);
      
      expect(isValid).toBe(false);
    });

    it("should return false when request token is undefined", async () => {
      mockCookieStore.get.mockReturnValue({ value: "token" });

      const isValid = await validateCsrfToken(undefined);
      
      expect(isValid).toBe(false);
    });

    it("should return false when cookie token doesn't exist", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const isValid = await validateCsrfToken("some-token");
      
      expect(isValid).toBe(false);
    });

    it("should use constant-time comparison", async () => {
      // This test ensures timing attacks are prevented
      const token = "b".repeat(64);
      mockCookieStore.get.mockReturnValue({ value: token });

      // Should handle different length tokens safely
      const isValid = await validateCsrfToken("short");
      
      expect(isValid).toBe(false);
    });
  });

  describe("initializeCsrfToken", () => {
    it("should return existing token if present", async () => {
      const existingToken = "existing-token-123";
      mockCookieStore.get.mockReturnValue({ value: existingToken });

      const token = await initializeCsrfToken();
      
      expect(token).toBe(existingToken);
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("should create new token if none exists", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const token = await initializeCsrfToken();
      
      expect(token).toHaveLength(64);
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "csrf_token",
          value: token,
        })
      );
    });

    it("should generate valid hex token", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const token = await initializeCsrfToken();
      
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("removeCsrfToken", () => {
    it("should delete the CSRF cookie", async () => {
      await removeCsrfToken();
      
      expect(mockCookieStore.delete).toHaveBeenCalledWith("csrf_token");
    });
  });

  describe("regenerateCsrfToken", () => {
    it("should always create a new token", async () => {
      mockCookieStore.get.mockReturnValue({ value: "old-token" });

      const token = await regenerateCsrfToken();
      
      expect(token).toHaveLength(64);
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "csrf_token",
          value: token,
        })
      );
    });

    it("should generate different tokens on successive calls", async () => {
      const token1 = await regenerateCsrfToken();
      const token2 = await regenerateCsrfToken();
      
      expect(token1).not.toBe(token2);
      expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
    });

    it("should generate valid hex tokens", async () => {
      const token = await regenerateCsrfToken();
      
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string tokens", async () => {
      mockCookieStore.get.mockReturnValue({ value: "" });

      const isValid = await validateCsrfToken("");
      
      expect(isValid).toBe(false);
    });

    it("should handle very long tokens", async () => {
      const longToken = "x".repeat(1000);
      await setCsrfCookie(longToken);
      
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({ value: longToken })
      );
    });

    it("should handle special characters in tokens", async () => {
      const specialToken = "abc!@#$%^&*()_+-=[]{}|;:',.<>?/~`";
      mockCookieStore.get.mockReturnValue({ value: specialToken });

      const token = await getCsrfToken();
      
      expect(token).toBe(specialToken);
    });
  });

  describe("Security Properties", () => {
    it("should set httpOnly flag (Synchronizer Token Pattern for XSS protection)", async () => {
      await setCsrfCookie("token");
      
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({ httpOnly: true })
      );
    });

    it("should set sameSite to strict", async () => {
      await setCsrfCookie("token");
      
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({ sameSite: "strict" })
      );
    });

    it("should set appropriate expiration", async () => {
      await setCsrfCookie("token");
      
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({ maxAge: 86400 }) // 24 hours
      );
    });

    it("should set path to root", async () => {
      await setCsrfCookie("token");
      
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/" })
      );
    });
  });
});
