// Auth token management utilities
// src/utils/auth.ts

import { deleteCookie, getCookie, setCookie } from "cookies-next"; 
import { createClient } from "./supabase/client";

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
  deleteCookie("ezygo_access_token");
};

export const handleLogout = async () => {
  const supabase = createClient();
  
  const clearCookie = (name: string) => {
    document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
  };
  
  try {
    await supabase.auth.signOut();
    localStorage.clear();
    clearCookie("terms_version");
    removeToken();
    
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  } catch (error) {
    console.error("Logout failed:", error);
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }
};