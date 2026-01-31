/**
 * Hook for initializing CSRF token
 * 
 * This hook fetches the CSRF token from the server and stores it
 * in sessionStorage for use in subsequent requests.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useCSRFToken();
 *   // ... rest of component
 * }
 * ```
 */

import { useEffect } from "react";
import { setCsrfToken } from "@/lib/axios";
import { logger } from "@/lib/logger";

export function useCSRFToken() {
  useEffect(() => {
    const initCsrf = async () => {
      try {
        // Call the /api/csrf/init endpoint to initialize the CSRF token
        // The token is stored in an httpOnly cookie (XSS-safe) and returned in response
        const response = await fetch("/api/csrf/init");
        if (response.ok) {
          const data = await response.json();
          // Store token in sessionStorage for use in subsequent requests
          setCsrfToken(data.token);
        } else {
          logger.error("Failed to initialize CSRF token:", response.statusText);
        }
      } catch (error) {
        // Log error but don't block the form - the token will be checked on submission
        logger.error("Failed to initialize CSRF token:", error);
      }
    };
    initCsrf();
  }, []);
}
