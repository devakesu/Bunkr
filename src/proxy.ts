import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getCspHeader } from "./lib/csp";

export async function proxy(request: NextRequest) {
  // 1. Get CSP Header
  const cspHeader = getCspHeader();

  // 2. Initialize Response
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // 3. Apply CSP to the initial response
  response.headers.set('Content-Security-Policy', cspHeader);

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
          response = NextResponse.next({ request });
          
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );

          // ⚠️ CRITICAL: Re-apply CSP to the new response
          response.headers.set('Content-Security-Policy', cspHeader);
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
    return redirectRes;
  }

  // Scenario B: Logged in -> Redirect to Dashboard
  if (ezygoToken && user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const redirectRes = NextResponse.redirect(url);
    redirectRes.headers.set('Content-Security-Policy', cspHeader);
    return redirectRes;
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/profile/:path*",
    "/notifications/:path*",
    "/tracking/:path*",
    "/contact",
    "/legal",
    "/api/((?!auth).*)",
  ],
};