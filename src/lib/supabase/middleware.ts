import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getCspHeader } from "../csp";
import { logger } from "../logger";

// Constants for error detection - defined at module scope for efficiency
const AUTH_STATUS_CODES = new Set<number>([401, 403]);
const AUTH_ERROR_CODES = new Set<string>([
  "INVALID_AUTH",
  "INVALID_JWT",
  "JWT_EXPIRED",
  "PGRST301",
  "PGRST302",
]);

// Type for errors with structured properties
interface StructuredError {
  status?: number;
  statusCode?: number;
  code?: string;
  name?: string;
  message?: string;
}

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
    
    // Use a more specific type for error to safely access properties
    const structuredError = error as StructuredError;

    // Prefer structured properties over brittle string matching on error messages
    const status: number | undefined =
      typeof structuredError?.status === "number"
        ? structuredError.status
        : typeof structuredError?.statusCode === "number"
          ? structuredError.statusCode
          : undefined;
    const errorCode: string | undefined =
      typeof structuredError?.code === "string" ? structuredError.code : undefined;
    const errorName: string | undefined =
      typeof structuredError?.name === "string" ? structuredError.name : undefined;

    const isAuthError =
      (status !== undefined && AUTH_STATUS_CODES.has(status)) ||
      (errorCode !== undefined && AUTH_ERROR_CODES.has(errorCode));

    if (isAuthError) {
      // Clear invalid session cookies for auth-specific errors
      const authCookies = request.cookies
        .getAll()
        .filter(({ name }) => name.startsWith("sb-") || name.includes("auth"))
        .map(({ name }) => name);

      authCookies.forEach((name) => {
        response.cookies.delete(name);
      });

      logger.warn(
        "Session refresh failed in middleware, clearing invalid session cookies",
        {
          error: errorMessage,
          status,
          code: errorCode,
          name: errorName,
        },
      );
    } else {
      // Log transient or unknown errors but don't clear cookies
      logger.warn(
        "Transient or non-auth error in session refresh, preserving session cookies",
        {
          error: errorMessage,
          status,
          code: errorCode,
          name: errorName,
        },
      );
    }
  }

  return response;
}