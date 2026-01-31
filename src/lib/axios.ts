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
 * Storage for CSRF token in memory (Synchronizer Token Pattern).
 * The token is stored in an httpOnly cookie server-side (XSS-safe),
 * but also returned in API responses for client to include in request headers.
 * 
 * IMPORTANT: Token must be initialized by calling /api/csrf/init endpoint
 * and storing the returned token using setCsrfToken().
 */
let csrfTokenCache: string | null = null;

/**
 * Get the current CSRF token from memory.
 * Used for Synchronizer Token Pattern in client-side requests.
 * 
 * @returns CSRF token from memory or null if not initialized
 */
export function getCsrfToken(): string | null {
  return csrfTokenCache;
}

/**
 * Set the CSRF token in memory after receiving it from server.
 * Should be called after fetching token from /api/csrf/init endpoint.
 * 
 * @param token - The CSRF token received from server
 */
export function setCsrfToken(token: string | null): void {
  csrfTokenCache = token;
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
