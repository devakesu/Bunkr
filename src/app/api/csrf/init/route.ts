/**
 * CSRF Token Initialization Route Handler
 * 
 * This route handler provides CSRF token initialization specifically for
 * client-side consumption (e.g., login form). This is necessary because
 * Next.js 15 forbids cookie mutations in Server Components.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { initializeCsrfToken } from "@/lib/security/csrf";
import { authRateLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/utils";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

export const dynamic = 'force-dynamic';

/**
 * GET /api/csrf/init
 * Initializes CSRF token for client-side use
 * 
 * This endpoint:
 * - Sets the CSRF token cookie via Route Handler (safe in Next.js 15)
 * - Returns the token value for client-side use
 * - Applies rate limiting to prevent DoS attacks
 * - Is public (no auth required) since it's called before login
 */
export async function GET() {
  try {
    // Get client IP for rate limiting
    const headersList = await headers();
    const ip = getClientIp(headersList);
    
    if (!ip) {
      logger.warn("Unable to determine client IP for CSRF init rate limiting");
      // Continue anyway - rate limiting is a defense layer but not critical for CSRF protection
    }
    
    // Apply rate limiting (10 requests per minute per IP)
    // Use a separate rate limit key for init vs. regenerate
    if (ip) {
      const { success, limit, reset, remaining } = await authRateLimiter.limit(`csrf_init_${ip}`);
      
      if (!success) {
        return NextResponse.json(
          { 
            error: "Too many CSRF initialization requests. Please try again later.",
            retryAfter: reset 
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            }
          }
        );
      }
    }
    
    // Initialize token (creates new token if none exists, or returns existing)
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
    // Log error to Sentry with context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error("CSRF token initialization error:", errorMessage);
    
    Sentry.captureException(error, {
      tags: { 
        type: "csrf_init_error",
        location: "csrf_init_route" 
      },
    });
    
    return NextResponse.json(
      { error: "Failed to initialize CSRF token" },
      { status: 500 }
    );
  }
}
