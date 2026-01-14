// Auth token management utilities
// src/utils/auth.ts

import { deleteCookie, getCookie, setCookie } from "cookies-next"; 

export const setToken = (token: string, expiresInDays: number = 31) => {
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  
  setCookie("ezygo_access_token", token, {
    expires: expiresAt,
    // secure: process.env.NODE_ENV === "production",
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