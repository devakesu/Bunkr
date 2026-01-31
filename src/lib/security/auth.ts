// Auth token management utilities
// src/lib/security/auth.ts
import { createClient } from "@/lib/supabase/client";
import * as Sentry from "@sentry/nextjs";
import { deleteCookie } from "cookies-next";

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
export const isAuthSessionMissingError = (error: any): boolean => {
  return error?.message?.toLowerCase().includes("session missing") ||
         error?.message?.toLowerCase().includes("auth session");
};

/**
 * Performs comprehensive logout with cleanup of all authentication state.
 * Handles Supabase session, local storage, cookies, and redirects to home.
 * 
 * Process:
 * 1. Sign out from Supabase (server-side session)
 * 2. Clear browser storage (localStorage, sessionStorage)
 * 3. Clear authentication and terms cookies via API
 * 4. Redirect to home page
 * 
 * Error Handling:
 * - Logs errors to Sentry
 * - Forces redirect even on failure to prevent user from being stuck
 * - Best-effort cleanup continues even if individual steps fail
 * 
 * @example
 * ```ts
 * await handleLogout();
 * // User is redirected to home page with all auth state cleared
 * ```
 */
export const handleLogout = async () => {
  const supabase = createClient();
  
  try {
    // 1. Sign out from Supabase (Server-side session)
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // 2. Clear Local Storage (Client-side cache)
    if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
    }

    // 3. Clear Cookies
    await fetch("/api/logout", { method: "POST" }); // Clear auth token
    deleteCookie("terms_version", { path: '/' }); // Clear legal acceptance
    
    // 4. Redirect
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }

  } catch (error) {
    console.error("Logout failed:", error);
    
    // Capture the error but don't trap the user
    Sentry.captureException(error, { 
        tags: { type: "logout_failure", location: "handleLogout" } 
    });

    // Force redirect anyway so user isn't stuck on a broken page
    if (typeof window !== "undefined") {
      // Best-effort cleanup of known app cookies; HttpOnly cookies cannot be cleared client-side
      await fetch("/api/logout", { method: "POST" });
      deleteCookie("terms_version", { path: '/' });
      window.location.href = "/";
    }
  }
};