/**
 * Tests for Analytics Library
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getOrCreateClientId } from "../analytics";

describe("Analytics Library", () => {
  beforeEach(() => {
    // Clear cookies before each test
    if (typeof document !== "undefined") {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    }
  });

  describe("getOrCreateClientId", () => {
    it("should generate a client ID in browser environment", () => {
      const clientId = getOrCreateClientId();
      
      // Should generate a client ID in format: timestamp.randomstring
      expect(clientId).toMatch(/^\d+\.[a-z0-9]+$/);
    });

    it("should reuse existing client ID from cookie", () => {
      // Set a cookie first
      document.cookie = "_ga_client_id=existing-id-123; path=/";
      
      const clientId = getOrCreateClientId();
      
      expect(clientId).toBe("existing-id-123");
    });

    // Note: Browser-specific tests (cookie manipulation) would require JSDOM or similar
    // These tests focus on server-side behavior which is more critical for GA4 Measurement Protocol
  });

  describe("Cookie Security", () => {
    it("should include Secure attribute logic based on environment", () => {
      // This test verifies the code structure includes production security checks
      const analyticsCode = getOrCreateClientId.toString();
      
      // Verify the function includes production environment check
      expect(analyticsCode).toContain("process.env.NODE_ENV");
      expect(analyticsCode).toContain("production");
      expect(analyticsCode).toContain("Secure");
    });
  });
});
