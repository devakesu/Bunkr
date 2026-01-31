/**
 * Hook for initializing CSRF token
 * 
 * This hook fetches the CSRF token from the server and stores it
 * in sessionStorage for use in subsequent requests.
 * 
 * ⚠️ SECURITY NOTE:
 * The token is stored in sessionStorage, which is accessible to JavaScript.
 * This implementation relies on strict XSS prevention measures (CSP with nonce,
 * input sanitization) to prevent token theft. See src/lib/security/csrf.ts
 * for detailed security architecture and trade-offs.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useCSRFToken();
 *   // Token is now available for API calls via axios interceptor
 * }
 * ```
 */

import { useEffect } from "react";
import { setCsrfToken } from "@/lib/axios";
import { logger } from "@/lib/logger";

// Module-level guards to prevent duplicate or concurrent CSRF initialization
let csrfInitPromise: Promise<void> | null = null;
let csrfInitialized = false;

export function useCSRFToken() {
  useEffect(() => {
    const initCsrf = async () => {
      // Only run in the browser
      if (typeof window === "undefined") {
        return;
      }

      // If we've already successfully initialized, do nothing
      if (csrfInitialized) {
        return;
      }

      // If an initialization is already in progress, wait for it to complete
      if (csrfInitPromise) {
        await csrfInitPromise;
        return;
      }

      csrfInitPromise = (async () => {
        try {
          // Call the /api/csrf/init endpoint to initialize the CSRF token
          // The token is stored in an httpOnly cookie (server-side validation)
          // and returned in the response for client-side storage in sessionStorage.
          // 
          // SECURITY: Token storage in sessionStorage is protected by CSP (see src/lib/csp.ts)
          // which prevents unauthorized script execution and XSS attacks.
          const response = await fetch("/api/csrf/init");
          if (response.ok) {
            const data = await response.json();
            // Store token in sessionStorage for use in subsequent requests
            setCsrfToken(data.token);
            csrfInitialized = true;
          } else {
            logger.error("Failed to initialize CSRF token:", response.statusText);
          }
        } catch (error) {
          // Log error but don't block the form - the token will be checked on submission
          logger.error("Failed to initialize CSRF token:", error);
        } finally {
          // Clear in-flight promise to allow retry on future attempts if needed
          csrfInitPromise = null;
        }
      })();

      await csrfInitPromise;
    };

    void initCsrf();
  }, []);
}
