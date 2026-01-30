/**
 * CSRF Protection Module
 * 
 * Implements double-submit cookie pattern for CSRF protection.
 * This module provides token generation and validation for protecting
 * against Cross-Site Request Forgery attacks.
 * 
 * IMPORTANT: Cookie writes must only happen in Route Handlers or Server Actions,
 * not in Server Components. Use getCsrfToken() from client/route handlers.
 */

import { cookies } from "next/headers";
import crypto from "crypto";

// Configuration
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

/**
 * Generate a cryptographically secure random CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Get the current CSRF token from cookies (read-only, safe for server components)
 * @returns The CSRF token if it exists, null otherwise
 */
export async function getCsrfToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CSRF_COOKIE_NAME);
  return token?.value || null;
}

/**
 * Set CSRF token in cookie
 * WARNING: This function can ONLY be called from Route Handlers or Server Actions,
 * NOT from Server Components. Calling from Server Components will cause:
 * "Error: Cookies can only be modified in a Server Action or Route Handler"
 * 
 * @param token - The CSRF token to set
 */
export async function setCsrfCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CSRF_COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Validate CSRF token from request against cookie
 * @param requestToken - Token from request header or body
 * @returns true if valid, false otherwise
 */
export async function validateCsrfToken(requestToken: string | null | undefined): Promise<boolean> {
  if (!requestToken) {
    return false;
  }

  const cookieToken = await getCsrfToken();
  
  if (!cookieToken) {
    return false;
  }

  // Quick length check before constant-time comparison
  // This doesn't leak timing information about the actual token value
  if (cookieToken.length !== requestToken.length) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(requestToken)
    );
  } catch (error) {
    // timingSafeEqual throws if buffers have different lengths
    // This should not happen due to the length check above, but handle it defensively
    return false;
  }
}

/**
 * Initialize CSRF token - creates new token if none exists
 * WARNING: Can ONLY be called from Route Handlers or Server Actions
 * @returns The token (existing or newly created)
 */
export async function initializeCsrfToken(): Promise<string> {
  const existingToken = await getCsrfToken();
  
  if (existingToken) {
    return existingToken;
  }

  const newToken = generateCsrfToken();
  await setCsrfCookie(newToken);
  
  return newToken;
}

/**
 * Regenerate CSRF token - always creates a new token
 * WARNING: Can ONLY be called from Route Handlers or Server Actions
 * @returns The new token
 */
export async function regenerateCsrfToken(): Promise<string> {
  const newToken = generateCsrfToken();
  await setCsrfCookie(newToken);
  
  return newToken;
}

/**
 * Remove CSRF token from cookies
 * WARNING: Can ONLY be called from Route Handlers or Server Actions
 */
export async function removeCsrfToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CSRF_COOKIE_NAME);
}
