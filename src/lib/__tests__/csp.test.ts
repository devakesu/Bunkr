/**
 * Tests for CSP (Content Security Policy) module
 */

import { describe, it, expect, afterEach } from "vitest";
import { getCspHeader } from "../csp";

describe("Content Security Policy", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    if (originalSupabaseUrl !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  });

  it("should return a CSP header string", () => {
    const header = getCspHeader();
    expect(typeof header).toBe("string");
    expect(header.length).toBeGreaterThan(0);
  });

  it("should include default-src directive", () => {
    const header = getCspHeader();
    expect(header).toContain("default-src 'self'");
  });

  it("should include script-src directive", () => {
    const header = getCspHeader();
    expect(header).toContain("script-src");
    expect(header).toContain("'self'");
  });

  it("should include style-src directive", () => {
    const header = getCspHeader();
    expect(header).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("should include font-src directive", () => {
    const header = getCspHeader();
    expect(header).toContain("font-src 'self'");
  });

  it("should set object-src to none", () => {
    const header = getCspHeader();
    expect(header).toContain("object-src 'none'");
  });

  it("should set base-uri to self", () => {
    const header = getCspHeader();
    expect(header).toContain("base-uri 'self'");
  });

  it("should set form-action to self", () => {
    const header = getCspHeader();
    expect(header).toContain("form-action 'self'");
  });

  it("should set frame-ancestors to none", () => {
    const header = getCspHeader();
    expect(header).toContain("frame-ancestors 'none'");
  });

  it("should include Supabase URL in img-src when set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    
    const header = getCspHeader();
    expect(header).toContain("https://example.supabase.co");
  });

  it("should include Supabase URL in connect-src when set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    
    const header = getCspHeader();
    const connectSrcSection = header.split("connect-src")[1];
    expect(connectSrcSection).toContain("https://example.supabase.co");
  });

  it("should handle missing Supabase URL gracefully", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    const header = getCspHeader();
    expect(header).toBeTruthy();
    expect(header).toContain("connect-src 'self'");
  });

  it("should include localhost in development", () => {
    // Test current environment (which should be test, not production)
    const header = getCspHeader();
    
    // In non-production, should include localhost
    if (process.env.NODE_ENV !== "production") {
      expect(header).toContain("localhost:3000");
    }
  });

  it("should include upgrade-insecure-requests in production", () => {
    // This tests the production path, but we can only verify the code logic
    // In actual production NODE_ENV, this would be included
    const header = getCspHeader();
    
    if (process.env.NODE_ENV === "production") {
      expect(header).toContain("upgrade-insecure-requests");
    } else {
      // In non-production, verify it's not there
      expect(header).not.toContain("upgrade-insecure-requests");
    }
  });

  it("should not include upgrade-insecure-requests in development", () => {
    // In test environment, should not include upgrade-insecure-requests
    const header = getCspHeader();
    
    if (process.env.NODE_ENV !== "production") {
      expect(header).not.toContain("upgrade-insecure-requests");
    }
  });

  it("should include worker-src directive", () => {
    const header = getCspHeader();
    expect(header).toContain("worker-src 'self' blob:");
  });

  it("should include frame-src directive", () => {
    const header = getCspHeader();
    expect(header).toContain("frame-src 'self'");
  });

  it("should not have excessive whitespace", () => {
    const header = getCspHeader();
    expect(header).not.toMatch(/\s{2,}/);
  });

  it("should NOT include Google Analytics domains (using server-side Measurement Protocol)", () => {
    const header = getCspHeader();
    expect(header).not.toContain("google-analytics.com");
    expect(header).not.toContain("googletagmanager.com");
    expect(header).not.toContain("doubleclick.net");
  });

  it("should include Cloudflare domains", () => {
    const header = getCspHeader();
    expect(header).toContain("cloudflareinsights.com");
    expect(header).toContain("challenges.cloudflare.com");
  });

  it("should include Sentry domains", () => {
    const header = getCspHeader();
    expect(header).toContain("ingest.sentry.io");
  });

  it("should include EzyGo API domain", () => {
    const header = getCspHeader();
    expect(header).toContain("production.api.ezygo.app");
  });

  it("should be trimmed and formatted", () => {
    const header = getCspHeader();
    expect(header).toBe(header.trim());
    expect(header[0]).not.toBe(" ");
    expect(header[header.length - 1]).not.toBe(" ");
  });
});
