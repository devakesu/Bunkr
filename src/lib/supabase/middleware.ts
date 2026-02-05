import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getCspHeader } from "../csp";
import { logger } from "../logger";

export async function updateSession(request: NextRequest, nonce?: string) {
  // 1. Get CSP Header
  const cspHeader = getCspHeader(nonce);

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

  try {
    await supabase.auth.getUser();
  } catch (error) {
    // Only clear cookies for authentication-specific errors (invalid/expired tokens)
    // Don't clear cookies for transient network issues or service unavailability
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerErrorMsg = errorMessage.toLowerCase();
    
    // Check for authentication-specific error patterns
    const isAuthError = lowerErrorMsg.includes('invalid') || 
                       lowerErrorMsg.includes('expired') ||
                       lowerErrorMsg.includes('unauthorized') ||
                       lowerErrorMsg.includes('jwt') ||
                       (lowerErrorMsg.includes('token') && (
                         lowerErrorMsg.includes('refresh') ||
                         lowerErrorMsg.includes('access') ||
                         lowerErrorMsg.includes('invalid') ||
                         lowerErrorMsg.includes('expired')
                       ));
    
    if (isAuthError) {
      // Clear invalid session cookies for auth-specific errors
      const authCookies = request.cookies.getAll()
        .filter(({ name }) => name.startsWith('sb-') || name.includes('auth'))
        .map(({ name }) => name);
      
      authCookies.forEach(name => {
        response.cookies.delete(name);
      });

      logger.warn("Session refresh failed in middleware, clearing invalid session cookies", {
        error: errorMessage,
      });
    } else {
      // Log transient errors but don't clear cookies
      logger.warn("Transient error in session refresh, preserving session cookies", {
        error: errorMessage,
      });
    }
  }

  return response;
}