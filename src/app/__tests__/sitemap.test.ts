/**
 * Tests for sitemap.ts
 */

import { describe, it, expect, afterEach } from "vitest";
import sitemap from "../sitemap";

describe("sitemap.xml", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (originalAppUrl !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    } else {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  it("should return an array of URLs", () => {
    const urls = sitemap();
    expect(Array.isArray(urls)).toBe(true);
    expect(urls.length).toBeGreaterThan(0);
  });

  it("should include homepage", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    
    const urls = sitemap();
    const homepage = urls.find(u => u.url === "https://example.com");
    
    expect(homepage).toBeDefined();
    expect(homepage?.priority).toBe(1);
  });

  it("should include login page", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    
    const urls = sitemap();
    const loginPage = urls.find(u => u.url === "https://example.com/login");
    
    expect(loginPage).toBeDefined();
    expect(loginPage?.priority).toBe(0.8);
  });

  it("should include contact page", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    
    const urls = sitemap();
    const contactPage = urls.find(u => u.url === "https://example.com/contact");
    
    expect(contactPage).toBeDefined();
    expect(contactPage?.priority).toBe(0.8);
  });

  it("should include legal page", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    
    const urls = sitemap();
    const legalPage = urls.find(u => u.url === "https://example.com/legal");
    
    expect(legalPage).toBeDefined();
    expect(legalPage?.priority).toBe(0.8);
  });

  it("should have 5 URLs total", () => {
    const urls = sitemap();
    expect(urls).toHaveLength(5);
  });

  it("should set lastModified for all URLs", () => {
    const urls = sitemap();
    
    urls.forEach(url => {
      expect(url.lastModified).toBeInstanceOf(Date);
    });
  });

  it("should set changeFrequency to monthly", () => {
    const urls = sitemap();
    
    urls.forEach(url => {
      expect(url.changeFrequency).toBe("monthly");
    });
  });

  it("should handle missing APP_URL", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    
    const urls = sitemap();
    expect(urls).toHaveLength(5);
    expect(urls[0].url).toBe("");
  });

  it("should have correct URL structure", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://test.com";
    
    const urls = sitemap();
    
    urls.forEach(url => {
      expect(url).toHaveProperty("url");
      expect(url).toHaveProperty("lastModified");
      expect(url).toHaveProperty("changeFrequency");
      expect(url).toHaveProperty("priority");
    });
  });

  it("should prioritize homepage highest", () => {
    const urls = sitemap();
    const homepage = urls[0];
    const others = urls.slice(1);
    
    expect(homepage.priority).toBeGreaterThan(others[0].priority || 0);
  });

  it("should have different priorities for different page types", () => {
    const urls = sitemap();
    const homepage = urls[0];
    const publicPages = urls.slice(1, 4); // login, contact, legal
    const buildInfo = urls[4]; // build-info
    
    // Homepage should have highest priority
    expect(homepage.priority).toBe(1);
    
    // Public pages should have equal priority
    const publicPriorities = publicPages.map(u => u.priority);
    expect(publicPriorities.every(p => p === 0.8)).toBe(true);
    
    // Build info should have lower priority
    expect(buildInfo.priority).toBe(0.5);
  });
});
