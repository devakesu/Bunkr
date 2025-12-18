import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // 1. Get the token from cookies
  const token = request.cookies.get("ezygo_access_token")?.value;

  // 2. Define protected routes
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isProfileRoute = request.nextUrl.pathname.startsWith("/profile");
  const isTrackingRoute = request.nextUrl.pathname.startsWith("/tracking");
  
  // 3. Define auth routes (login page)
  const isAuthRoute = request.nextUrl.pathname === "/";

  // Scenario A: User is NOT logged in but tries to access protected page
  if (!token && (isDashboardRoute || isProfileRoute || isTrackingRoute)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Scenario B: User IS logged in but tries to access login page
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Configure which paths the proxy runs on
export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/profile/:path*",
    "/tracking/:path*",
  ],
};