import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // 1. Define CSP Header (Centralized Place)
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://www.googletagmanager.com https://challenges.cloudflare.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ''} https://www.googletagmanager.com https://www.google-analytics.com https://*.google.com https://*.google.co.in;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-src 'self' https://challenges.cloudflare.com;
    frame-ancestors 'none';
    worker-src 'self' blob:;
    connect-src 'self' 
      ${process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ''}
      https://production.api.ezygo.app
      https://*.ingest.sentry.io 
      https://*.google-analytics.com 
      https://*.analytics.google.com 
      https://analytics.google.com
      https://*.googletagmanager.com
      https://stats.g.doubleclick.net
      https://www.google-analytics.com
      https://challenges.cloudflare.com
      ws://localhost:3000 
      http://localhost:3000
      https://*.ngrok-free.dev;
    ${process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests;' : ''}
  `.replace(/\s{2,}/g, ' ').trim();

  // 2. Initialize the response
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // 3. Apply CSP to the initial response
  response.headers.set('Content-Security-Policy', cspHeader);

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
          
          // Supabase needs to create a NEW response to set cookies
          response = NextResponse.next({ request });
          
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          response.headers.set('Content-Security-Policy', cspHeader);
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}