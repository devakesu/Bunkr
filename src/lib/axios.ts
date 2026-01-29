// Axios instance with base URL and auth token
// src/lib/axios.ts

import axios from "axios";
import { CSRF_HEADER, CSRF_TOKEN_NAME } from "@/lib/security/csrf-constants";

const axiosInstance = axios.create({
  baseURL: "/api/backend/",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 10000,
});

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function ensureCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  let token = getCookie(CSRF_TOKEN_NAME);
  if (!token) {
    // Generate a 32-byte hex token client-side for double-submit in dev when no server token is set yet
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    document.cookie = `${CSRF_TOKEN_NAME}=${encodeURIComponent(token)}; path=/; SameSite=Lax; expires=${expires.toUTCString()}`;
  }
  return token;
}

// Attach CSRF token from readable cookie (double-submit pattern)
axiosInstance.interceptors.request.use((config) => {
  if (typeof document !== "undefined") {
    const token = ensureCsrfToken();
    if (token) {
      config.headers.set(CSRF_HEADER, token);
    }
  }
  return config;
});

export default axiosInstance;
