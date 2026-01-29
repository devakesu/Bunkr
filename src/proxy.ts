import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getCspHeader } from "./lib/csp";

/**
 * Creates a cryptographically secure nonce for CSP.
 * Uses Web Crypto API for compatibility with both Node.js and Edge runtimes.
 */
function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Convert to base64 using btoa and proper string conversion
  // This works in both Node.js (v20+) and Edge runtime
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
  // Match all routes except:
  // - Static assets (_next/static, _next/image, favicon.ico, robots.txt)
  // - API routes (handled separately with their own auth)
  // 
  // This simplified matcher pattern uses a negative lookahead regex to exclude specific paths.
  // Any new routes will automatically have CSP headers and Supabase session refresh applied.
  // 
  // Pattern explanation: /((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)
  // - Matches all paths that DON'T START with: api, _next/static, _next/image, favicon.ico, or robots.txt
  // - The negative lookahead (?!...) is evaluated BEFORE matching, so excluded paths don't invoke middleware
  // - This is more efficient than matching all routes then filtering, as Next.js optimizes the regex
  // 
  // This ensures middleware runs on all page routes for proper security headers and auth handling.
  // Public routes like /health are under /api and are excluded by the 'api' pattern.
  // Static files in /public are served directly and don't go through middleware.
  // If you need to add more exclusions (e.g., /sitemap.xml), add them to the pattern below.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};