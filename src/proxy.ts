import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getCspHeader } from "./lib/csp";

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // 1. Get CSP Header
  const cspHeader = getCspHeader(nonce);

  // 2. Initialize Response
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // 3. Apply CSP to the initial response
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set("x-nonce", nonce);

  // 4. Initialize Supabase
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );

          // ⚠️ CRITICAL: Re-apply CSP to the new response
          response.headers.set('Content-Security-Policy', cspHeader);
          response.headers.set("x-nonce", nonce);
        },
      },
    }
  );

  // 5. Refresh Session
  const { data: { user } } = await supabase.auth.getUser();

  // 6. Routing Logic
  const ezygoToken = request.cookies.get("ezygo_access_token")?.value;
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isProfileRoute = request.nextUrl.pathname.startsWith("/profile");
  const isNotificationsRoute = request.nextUrl.pathname.startsWith("/notifications");
  const isTrackingRoute = request.nextUrl.pathname.startsWith("/tracking");
  const isAuthRoute = request.nextUrl.pathname === "/";

  // Scenario A: Not logged in -> Redirect to Login
  if ((!ezygoToken || !user) && (isDashboardRoute || isProfileRoute || isNotificationsRoute || isTrackingRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const redirectRes = NextResponse.redirect(url);
    redirectRes.headers.set('Content-Security-Policy', cspHeader);
    redirectRes.headers.set("x-nonce", nonce);
    return redirectRes;
  }

  // Scenario B: Logged in -> Redirect to Dashboard
  if (ezygoToken && user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const redirectRes = NextResponse.redirect(url);
    redirectRes.headers.set('Content-Security-Policy', cspHeader);
    redirectRes.headers.set("x-nonce", nonce);
    return redirectRes;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};