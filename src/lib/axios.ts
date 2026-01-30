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

export function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function ensureCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  // Only read existing token - never generate client-side
  // Token must be initialized server-side through a trusted flow
  const token = getCookie(CSRF_TOKEN_NAME);
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
