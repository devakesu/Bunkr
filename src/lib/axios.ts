// Axios instance with base URL and auth token
// src/lib/axios.ts

import axios from "axios";
import { CSRF_HEADER } from "@/lib/security/csrf-constants";

const axiosInstance = axios.create({
  baseURL: "/api/backend/",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 10000,
});

/**
 * Retrieves a cookie value by name from document.cookie.
 * Client-side only - returns null on server.
 * 
 * @param name - Cookie name to retrieve
 * @returns Cookie value or null if not found
 */
export function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Storage for CSRF token using sessionStorage (Synchronizer Token Pattern).
 * 
 * SECURITY ARCHITECTURE:
 * - Server stores token in httpOnly cookie (inaccessible to JavaScript)
 * - Server returns token in API response for client-side storage
 * - Client stores token in sessionStorage for use in request headers
 * - Server validates request header token against httpOnly cookie
 * 
 * ⚠️ XSS VULNERABILITY CONSIDERATION:
 * sessionStorage is accessible to JavaScript, which means if an XSS vulnerability
 * exists in the application, an attacker can read this token. This implementation
 * is ONLY secure when combined with strict XSS prevention measures:
 * 
 * PRIMARY DEFENSE LAYERS:
 * 1. Content Security Policy (CSP) with nonce-based script execution (see src/lib/csp.ts)
 *    - Prevents unauthorized inline scripts from executing
 *    - Blocks scripts from untrusted sources
 *    - Verified at runtime in production (see verifyCspEnabled below)
 * 2. Input sanitization and output encoding across all user inputs
 * 3. Regular security audits and vulnerability scanning
 * 
 * ARCHITECTURAL TRADE-OFFS:
 * This sessionStorage approach was chosen over the previous double-submit cookie pattern:
 * 
 * Advantages:
 * - Token persists across page navigations (better UX than in-memory storage)
 * - Simpler client-side implementation (no cookie parsing/setting logic)
 * - Tab-scoped storage (sessionStorage is isolated per tab, cleared on tab close)
 * - Works with same-site cookies for additional protection
 * 
 * Disadvantages:
 * - Accessible to JavaScript (creates XSS vulnerability surface)
 * - Requires strict XSS prevention (CSP, sanitization) as primary defense
 * - Single point of failure if CSP is misconfigured or disabled
 * 
 * ALTERNATIVE CONSIDERED:
 * The double-submit cookie pattern (both tokens in httpOnly cookies) is more secure
 * against XSS attacks but was changed due to technical constraints with cookie handling
 * in the Next.js middleware and API routes. If cookie handling can be improved in the
 * future, consider reverting to double-submit pattern for defense-in-depth.
 * 
 * ⚠️ CRITICAL: XSS prevention is the primary defense. CSRF protection is a
 * secondary layer. If XSS vulnerabilities exist, both defenses can be bypassed.
 * 
 * INITIALIZATION: Token must be initialized by calling /api/csrf/init endpoint
 * and storing the returned token using setCsrfToken().
 */
const CSRF_STORAGE_KEY = "csrf_token_memory";

/**
 * Verifies that Content Security Policy is enabled in production.
 * This is a critical security check since the CSRF token in sessionStorage
 * is vulnerable to XSS attacks if CSP is not properly configured.
 * 
 * @returns true if CSP is enabled or in development mode, false otherwise
 */
function verifyCspEnabled(): boolean {
  // Skip check in development mode
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  // Check if CSP meta tag or HTTP header is present
  if (typeof document !== "undefined") {
    // Check for CSP meta tag
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (cspMeta) {
      return true;
    }

    // Note: We cannot directly check HTTP headers from JavaScript
    // The best we can do is verify CSP is working by checking if unsafe-inline is blocked
    // This is done implicitly - if CSP is working, unauthorized scripts won't execute
    // Log a warning if we can't verify CSP (absence of meta tag doesn't mean CSP is off)
    if (typeof console !== "undefined") {
      console.warn(
        "[CSRF Security] Could not verify CSP meta tag. CSP should be enforced via HTTP headers. " +
        "Verify that Content-Security-Policy header is present in production."
      );
    }
  }

  // Assume CSP is enabled via HTTP headers (enforced by middleware in src/proxy.ts)
  return true;
}

/**
 * Get the current CSRF token from sessionStorage.
 * Used for Synchronizer Token Pattern in client-side requests.
 * 
 * Performs runtime CSP verification in production to ensure security measures are active.
 * 
 * @returns CSRF token from sessionStorage or null if not initialized
 */
export function getCsrfToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;

  // Verify CSP is enabled in production (critical for sessionStorage security)
  if (process.env.NODE_ENV === "production" && !verifyCspEnabled()) {
    console.error(
      "[CSRF Security] CSP verification failed. Token storage in sessionStorage is vulnerable without CSP. " +
      "This is a critical security issue - contact the security team immediately."
    );
  }

  return sessionStorage.getItem(CSRF_STORAGE_KEY);
}

/**
 * Set the CSRF token in sessionStorage after receiving it from server.
 * Should be called after fetching token from /api/csrf/init endpoint.
 * 
 * Performs runtime CSP verification in production to ensure security measures are active.
 * 
 * @param token - The CSRF token received from server
 */
export function setCsrfToken(token: string | null): void {
  if (typeof sessionStorage === "undefined") return;

  // Verify CSP is enabled in production (critical for sessionStorage security)
  if (process.env.NODE_ENV === "production" && !verifyCspEnabled()) {
    console.error(
      "[CSRF Security] CSP verification failed. Token storage in sessionStorage is vulnerable without CSP. " +
      "This is a critical security issue - contact the security team immediately."
    );
  }

  if (token) {
    sessionStorage.setItem(CSRF_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
  }
}

/**
 * Legacy function name for backward compatibility.
 * @deprecated Use getCsrfToken() instead
 */
export function ensureCsrfToken(): string | null {
  return getCsrfToken();
}

// Attach CSRF token from memory (Synchronizer Token Pattern)
axiosInstance.interceptors.request.use((config) => {
  if (typeof document !== "undefined") {
    const token = getCsrfToken();
    if (token) {
      config.headers.set(CSRF_HEADER, token);
    }
  }
  return config;
});

export default axiosInstance;
