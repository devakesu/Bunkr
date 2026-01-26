// Auth token management utilities
// src/utils/auth.ts

import { deleteCookie, getCookie, setCookie } from "cookies-next"; 
import { createClient } from "./supabase/client";
import * as Sentry from "@sentry/nextjs";

export const setToken = (token: string, expiresInDays: number = 31) => {
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  
  setCookie("ezygo_access_token", token, {
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
};

export const getToken = () => {
  return getCookie("ezygo_access_token") as string | undefined;
};

export const removeToken = () => {
  deleteCookie("ezygo_access_token", { path: '/' });
};

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
    removeToken(); // Clear auth token
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
       // Clear cookies manually as a last resort backup if API failed
       document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
       });
       window.location.href = "/";
    }
  }
};