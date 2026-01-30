/**
 * CSRF Token API Route
 * 
 * This route handler provides CSRF token initialization.
 * It's a Route Handler, which is allowed to modify cookies in Next.js App Router.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { initializeCsrfToken, regenerateCsrfToken } from "@/lib/security/csrf";
import { authRateLimiter } from "@/lib/ratelimit";

export const dynamic = 'force-dynamic';

/**
 * GET /api/csrf
 * Returns CSRF token for use in forms
 * Initializes token if it doesn't exist
 */
export async function GET() {
  try {
    // Initialize token if needed (this will set the cookie via Route Handler)
    const token = await initializeCsrfToken();
    
    return NextResponse.json(
      { 
        token,
        message: "CSRF token initialized successfully" 
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      }
    );
  } catch (error) {
    // Log minimal error info to avoid leaking sensitive details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("CSRF token initialization error:", { message: errorMessage });
    
    return NextResponse.json(
      { error: "Failed to initialize CSRF token" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/csrf
 * Explicitly refresh/regenerate CSRF token (always creates new token)
 * Rate limited to prevent abuse and token exhaustion attacks
 */
export async function POST() {
  try {
    // Get client IP for rate limiting
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0] : "127.0.0.1";
    
    // Apply rate limiting to prevent token regeneration abuse
    const { success } = await authRateLimiter.limit(`csrf_regen_${ip}`);
    
    if (!success) {
      return NextResponse.json(
        { error: "Too many token regeneration requests. Please try again later." },
        { status: 429 }
      );
    }
    
    const token = await regenerateCsrfToken();
    
    return NextResponse.json(
      { 
        token,
        message: "CSRF token refreshed successfully" 
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      }
    );
  } catch (error) {
    // Log minimal error info to avoid leaking sensitive details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("CSRF token refresh error:", { message: errorMessage });
    
    return NextResponse.json(
      { error: "Failed to refresh CSRF token" },
      { status: 500 }
    );
  }
}
