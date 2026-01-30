/**
 * CSRF Token API Route
 * 
 * This route handler provides CSRF token initialization.
 * It's a Route Handler, which is allowed to modify cookies in Next.js App Router.
 */

import { NextResponse } from "next/server";
import { initializeCsrfToken, regenerateCsrfToken } from "@/lib/security/csrf";

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
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      }
    );
  } catch (error) {
    console.error("CSRF token initialization error:", error);
    
    return NextResponse.json(
      { error: "Failed to initialize CSRF token" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/csrf
 * Explicitly refresh/regenerate CSRF token (always creates new token)
 */
export async function POST() {
  try {
    const token = await regenerateCsrfToken();
    
    return NextResponse.json(
      { 
        token,
        message: "CSRF token refreshed successfully" 
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      }
    );
  } catch (error) {
    console.error("CSRF token refresh error:", error);
    
    return NextResponse.json(
      { error: "Failed to refresh CSRF token" },
      { status: 500 }
    );
  }
}
