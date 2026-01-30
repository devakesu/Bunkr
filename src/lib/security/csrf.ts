// CSRF Token Generation and Validation (Server-side only)
// src/lib/security/csrf.ts
"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { CSRF_HEADER, CSRF_TOKEN_NAME } from "./csrf-constants";

const TOKEN_LENGTH = 32;
const TOKEN_TTL = 3600; // 1 hour in seconds

/**
 * Generates a cryptographically secure CSRF token
 * @returns Hex-encoded token string
 */
async function generateCsrfToken(): Promise<string> {
  return crypto.randomBytes(TOKEN_LENGTH).toString("hex");
}

/**
 * Sets CSRF token in readable cookie (not HTTP-only for double-submit pattern)
 * Server Actions: Use this to set token for client-side forms
 * 
 * SECURITY NOTE: httpOnly: false is intentional and safe for the double-submit pattern.
 * The cookie must be readable by client JavaScript to include it in request headers.
 * Protection comes from the requirement that BOTH the cookie AND header must match,
 * combined with SameSite=lax which prevents cross-site cookie access. An attacker
 * cannot read the cookie value from a different origin, preventing CSRF attacks.
 * 
 * CRITICAL XSS DEPENDENCY: This pattern is vulnerable if the application has XSS vulnerabilities.
 * An XSS attack could read the cookie value and include it in malicious requests. Therefore:
 * 
 * REQUIRED XSS PREVENTION MEASURES (all layers must be maintained):
 * 
 * 1. Content Security Policy (CSP) - IMPLEMENTED in src/lib/csp.ts
 *    • Production: Enforces nonce-based script execution with 'strict-dynamic'
 *    • Only scripts with valid nonces can execute, preventing XSS injection
 *    • CSP headers applied via middleware (src/proxy.ts)
 * 
 * 2. React Built-in XSS Protection - USED THROUGHOUT
 *    • React automatically escapes all rendered content
 *    • dangerouslySetInnerHTML is avoided (or sanitized when necessary)
 *    • User input is never directly inserted into DOM
 * 
 * 3. Input Validation & Sanitization - APPLIED TO ALL USER INPUTS
 *    • All API endpoints validate input format and type
 *    • File uploads restricted by type and size
 *    • SQL injection prevented via parameterized queries (Supabase RLS)
 * 
 * 4. Dependency Security - ONGOING MAINTENANCE
 *    • Regular updates via dependabot
 *    • Security audits with npm audit
 *    • Third-party scripts loaded via Subresource Integrity (SRI) when possible
 * 
 * 5. Cookie Security Best Practices - IMPLEMENTED
 *    • SameSite=lax prevents cross-site cookie sending
 *    • Secure flag enabled in production (HTTPS only)
 *    • Path=/ limits cookie scope to application
 *    • MaxAge limits token lifetime to 1 hour
 * 
 * MONITORING & INCIDENT RESPONSE (RECOMMENDED OPERATIONAL PRACTICES):
 * • Monitor CSRF validation failures via your application's logging or security tooling
 * • Configure centralized monitoring (e.g., log aggregation or an error-reporting service) for anomalies
 * • In case of suspected XSS: Rotate CSRF secrets, review recent code changes, and audit access logs
 * 
 * Without these XSS prevention measures, this CSRF protection can be bypassed.
 * Regular security audits and code reviews are essential to maintain these protections.
 */
export async function setCsrfCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_TOKEN_NAME, token, {
    httpOnly: false, // must be readable by client to send double-submit header
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL,
  });
}

/**
 * Gets CSRF token from cookie
 * Server-side only
 */
export async function getCsrfTokenFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_TOKEN_NAME)?.value;
}

/**
 * Private helper: Validates CSRF token comparison
 * Requires both header token and cookie token to be present, non-empty, and match
 * @param headerToken Token from request header
 * @param cookieToken Token from cookie store
 * @returns true if tokens are valid and match, false otherwise
 */
function compareTokens(headerToken: string | null, cookieToken: string | null | undefined): boolean {
  try {
    // Trim tokens first to ensure consistent whitespace handling
    const trimmedHeaderToken = headerToken?.trim() ?? '';
    const trimmedCookieToken = cookieToken?.trim() ?? '';

    // Validate header token - must not be empty after trimming
    if (!trimmedHeaderToken) {
      return false;
    }

    // Validate cookie token - must not be empty after trimming
    if (!trimmedCookieToken) {
      // Token must be pre-initialized through a trusted flow (e.g., GET request)
      // Never accept a token without a matching cookie to prevent CSRF bypass
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    // Check lengths first since timingSafeEqual requires equal-length buffers
    const headerBuffer = Buffer.from(trimmedHeaderToken);
    const cookieBuffer = Buffer.from(trimmedCookieToken);
    
    if (headerBuffer.length !== cookieBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(headerBuffer, cookieBuffer);
  } catch {
    return false;
  }
}

/**
 * Validates CSRF token from request header against cookie value
 * Requires both header and cookie to be present, non-empty, and match
 * @param request Request object or headers
 * @returns true if token is valid, false otherwise
 */
export async function validateCsrfToken(request: Request): Promise<boolean> {
  try {
    const headerToken = request.headers.get(CSRF_HEADER);
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(CSRF_TOKEN_NAME)?.value;
    
    return compareTokens(headerToken, cookieToken);
  } catch {
    return false;
  }
}

/**
 * Validates CSRF token from Headers object (for Server Actions)
 * Requires both header and cookie to be present, non-empty, and match
 * @param headerList Next.js Headers object from headers()
 * @returns true if token is valid, false otherwise
 */
export async function validateCsrfTokenFromHeaders(headerList: Headers): Promise<boolean> {
  try {
    const headerToken = headerList.get(CSRF_HEADER);
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(CSRF_TOKEN_NAME)?.value;
    
    return compareTokens(headerToken, cookieToken);
  } catch {
    return false;
  }
}

/**
 * Generates and optionally retrieves CSRF token for forms
 * Just generates a token - the cookie will be set by the API route during validation
 */
export async function initializeCsrfToken(): Promise<string> {
  // Check if token already exists in cookie
  const existingToken = await getCsrfTokenFromCookie();
  if (existingToken) {
    return existingToken;
  }
  
  // Generate new token and set cookie immediately
  const token = await generateCsrfToken();
  await setCsrfCookie(token);
  return token;
}

/**
 * Clears CSRF token (useful on logout)
 */
export async function clearCsrfToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_TOKEN_NAME, "", {
    httpOnly: false, // Must match the setting used when creating the cookie
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
