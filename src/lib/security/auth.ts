// Auth token management utilities
// src/lib/security/auth.ts
import { createClient } from "@/lib/supabase/client";
import * as Sentry from "@sentry/nextjs";
import { deleteCookie } from "cookies-next";
import { logger } from "@/lib/logger";

/**
 * Checks if an error is related to a missing authentication session.
 * This helper provides a more robust check than exact string matching,
 * making it resilient to error message variations.
 * 
 * @param error - The error object to check
 * @returns true if the error is related to a missing auth session
 * 
 * @example
 * ```ts
 * const { error } = await supabase.auth.getUser();
 * if (error && !isAuthSessionMissingError(error)) {
 *   throw error; // Only throw if it's not a session missing error
 * }
 * ```
 */
export const isAuthSessionMissingError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  if (!('message' in error) || typeof error.message !== 'string') {
    return false;
  }
  const lowerMessage = error.message.toLowerCase();
  return lowerMessage.includes("session missing") || lowerMessage.includes("auth session");
};

/**
 * Performs comprehensive logout with cleanup of all authentication state.
 * Handles Supabase session, local storage, cookies, and redirects to home.
 * 
 * Process:
 * 1. Sign out from Supabase (server-side session)
 * 2. Clear browser storage (localStorage, sessionStorage)
 * 3. Clear authentication and terms cookies via API (with CSRF protection)
 * 4. Redirect to home page
 * 
 * Error Handling:
 * - Logs errors to Sentry
 * - Forces redirect even on failure to prevent user from being stuck
 * - Best-effort cleanup continues even if individual steps fail
 * 
 * @param csrfToken - Optional CSRF token for API logout. If not provided, will attempt to retrieve from storage.
 * 
 * @example
 * ```ts
 * import { getCsrfToken } from "@/lib/axios";
 * 
 * const csrfToken = getCsrfToken();
 * await handleLogout(csrfToken);
 * // User is redirected to home page with all auth state cleared
 * ```
 */
export const handleLogout = async (csrfToken?: string | null) => {
  const supabase = createClient();
  
  // Get CSRF token early (avoid duplication in try/catch blocks)
  const { getCsrfToken: getToken } = await import("@/lib/axios");
  const token = csrfToken ?? getToken();
  
  try {
    // 1. Sign out from Supabase (Server-side session)
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // 2. Clear Local Storage (Client-side cache)
    if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
    }

    // 3. Clear Cookies with CSRF protection
    if (token) {
      await fetch("/api/logout", { 
        method: "POST",
        headers: {
          "x-csrf-token": token
        }
      });
    } else {
      logger.warn("Logout called without CSRF token - server cookies may not be cleared. User will need to re-authenticate on next visit.");
    }
    deleteCookie("terms_version", { path: '/' }); // Clear legal acceptance (client-side cookie)
    
    // 4. Redirect
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }

  } catch (error) {
    logger.error("Logout failed:", error);
    
    // Capture the error but don't trap the user
    Sentry.captureException(error, { 
        tags: { type: "logout_failure", location: "handleLogout" } 
    });

    // Force redirect anyway so user isn't stuck on a broken page
    if (typeof window !== "undefined") {
      // Best-effort cleanup of known app cookies
      if (token) {
        await fetch("/api/logout", { 
          method: "POST",
          headers: {
            "x-csrf-token": token
          }
        });
      }
      deleteCookie("terms_version", { path: '/' });
      window.location.href = "/";
    }
  }
};