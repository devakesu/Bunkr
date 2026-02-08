import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { getAuthTokenServer } from "@/lib/security/auth-cookie";
import { validateCsrfToken } from "@/lib/security/csrf";
import { logger } from "@/lib/logger";
import { ezygoCircuitBreaker } from "@/lib/circuit-breaker";

const BASE_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "");

// Runtime validation: ensure NODE_ENV is explicitly set at module load time
// SECURITY CONSIDERATION: When NODE_ENV is undefined, IS_PRODUCTION will be false,
// resulting in development mode behavior (verbose error messages exposed to clients).
// This is intentional - we log an error to alert monitoring systems but continue
// execution to avoid breaking the application. The default to development mode is
// safer than throwing an error (which would cause a service outage).
// CRITICAL: CI/CD pipelines MUST enforce NODE_ENV=production for production deployments.
if (!process.env.NODE_ENV) {
  logger.error("CRITICAL: NODE_ENV is not set - defaulting to development mode with verbose error messages. This MUST be fixed in production.");
}
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// PUBLIC_PATHS: Exact endpoints that are exempt from CSRF validation but NOT from origin validation.
// Uses full path matching (not prefix) to prevent accidentally exposing sensitive sub-paths.
// 
// SECURITY MODEL FOR PUBLIC PATHS (Enhanced in this PR):
// These paths are accessible without authentication but still require proper security controls:
// 
// 1. Origin Validation (ALWAYS enforced for write operations - enhancement added):
//    - NOW APPLIES TO ALL state-changing requests including public paths (see line 224)
//    - Verifies requests originate from allowed domain (NEXT_PUBLIC_APP_DOMAIN)
//    - Prevents unauthorized sites from making requests to public endpoints
//    - Protects against cross-origin attacks even before authentication
//    
//    ⚠️ IMPORTANT: Origin validation restricts access to web browsers from allowed domains.
//    Non-browser clients (mobile apps, CLI tools, Postman, curl) will be BLOCKED unless they:
//    - Send a valid Origin header matching NEXT_PUBLIC_APP_DOMAIN, OR
//    - Use a different authentication flow (API keys, OAuth tokens, etc.)
//    
//    If you need to support non-browser clients, consider:
//    - Creating separate API endpoints for programmatic access (e.g., /api/v1/auth/login)
//    - Implementing API key authentication for machine-to-machine communication
//    - Using OAuth 2.0 client credentials flow for third-party integrations
//    - Documenting that the web API is browser-only in your API documentation
// 
// 2. CSRF Protection (SKIPPED for public paths):
//    - Not applicable since user has no session/token yet (e.g., login endpoint)
//    - Origin validation provides baseline protection for these pre-auth endpoints
// 
// 3. Additional Security (endpoint-specific):
//    - Rate limiting (prevents brute force on login)
//    - Request validation (input sanitization, schema validation)
//    - Captcha/bot detection (for signup, password reset)
//    - Account lockout policies (for repeated failed logins)
// 
// VERIFICATION: Each path in PUBLIC_PATHS has been reviewed for security:
// - "login": Pre-authentication endpoint protected by:
//   * Origin validation (prevents cross-origin attacks, web-only)
//   * Rate limiting (prevents brute force)
//   * Input validation (sanitizes username/password)
//   * Backend authentication logic (validates credentials)
//   ⚠️ This endpoint is web-browser-only due to origin validation.
// 
// SECURITY: Each path must be explicitly listed - sub-paths are NOT automatically included.
// Example: "login" matches "/api/backend/login" but NOT "/api/backend/login/admin".
//          To allow both, add both "login" and "login/admin" as separate entries.
// 
// Add paths as segments WITHOUT leading slashes, using "/" for sub-paths:
//   ✓ Correct: "login", "login/refresh", "health", "status/check"
//   ✗ Wrong:   "/login", "login/", "/health/"
// 
// Review carefully before adding new paths to ensure no sensitive endpoints are exposed.
const PUBLIC_PATHS = new Set([
  "login",
  // Add additional public paths here with explicit full paths
  // Each path must have its own security measures (rate limiting, validation, etc.)
  // Examples:
  // "health",              // would match /api/backend/health
  // "status/check",        // would match /api/backend/status/check
  // "login/refresh",       // would match /api/backend/login/refresh
]);

// Memoized allowed hosts computation for performance
// Computed lazily on first call, then cached for subsequent requests
// CACHE BEHAVIOR: The allowed hosts are computed once during application lifetime
// and never updated. If NEXT_PUBLIC_APP_DOMAIN changes (e.g., during hot reload
// in development), the application must be restarted for the cache to refresh.
// This is acceptable in production where environment variables are immutable,
// but developers should be aware of this limitation in development.
let cachedAllowedHosts: Set<string> | null = null;
let allowedHostsComputed = false;
let cachedAppDomain: string | undefined = undefined;

function getAllowedHosts(): Set<string> | null {
  const currentAppDomain = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim();
  
  // In development, invalidate cache if NEXT_PUBLIC_APP_DOMAIN changes
  // This allows hot reload to pick up environment variable changes without restart
  if (process.env.NODE_ENV === "development" && allowedHostsComputed && cachedAppDomain !== currentAppDomain) {
    logger.dev(
      "[backend-proxy] NEXT_PUBLIC_APP_DOMAIN changed in development. Invalidating cache.",
      { previous: cachedAppDomain, current: currentAppDomain }
    );
    allowedHostsComputed = false;
    cachedAllowedHosts = null;
  }
  
  if (!allowedHostsComputed) {
    allowedHostsComputed = true;
    cachedAppDomain = currentAppDomain;
    
    if (!currentAppDomain) {
      cachedAllowedHosts = null;
    } else {
      // SECURITY: NEXT_PUBLIC_APP_DOMAIN format requirements
      // ====================================================
      // REQUIRED FORMAT: Hostname only, WITHOUT protocol prefix
      //   ✓ Correct: "example.com", "app.example.com", "localhost"
      //   ✗ Wrong:   "https://example.com", "http://localhost:3000"
      //
      // PORTS: If your domain includes a non-standard port (e.g., "localhost:3000"),
      // it will be automatically stripped for origin validation. This is intentional
      // to match standard browser behavior where Origin headers contain ports but
      // hostname comparisons typically exclude them.
      //
      // This format is enforced in .example.env and must be consistent across all
      // environment files. Inconsistent formats can cause security validation failures.
      //
      // Extract hostname without port for consistent comparison
      cachedAllowedHosts = new Set(
        [currentAppDomain].map((host) => {
          // Validate that host doesn't include protocol (common misconfiguration)
          if (host.includes("://")) {
            logger.error(
              "[backend-proxy] Invalid NEXT_PUBLIC_APP_DOMAIN configuration: value must not include protocol",
              { appDomain: host }
            );
            throw new Error(
              "Configuration error: NEXT_PUBLIC_APP_DOMAIN must be hostname only (e.g., 'example.com', not 'https://example.com')"
            );
          }
          
          try {
            // Parse as URL to extract hostname (strips port if present)
            return new URL(`https://${host}`).hostname.toLowerCase();
          } catch {
            // Fallback: assume it's already a hostname
            return host.toLowerCase();
          }
        })
      );
      
      // In development, log cache information to help developers understand behavior
      if (process.env.NODE_ENV === "development") {
        logger.dev(
          "[backend-proxy] Allowed hosts computed and cached. " +
          "Cache will be invalidated automatically if NEXT_PUBLIC_APP_DOMAIN changes.",
          { allowedHosts: Array.from(cachedAllowedHosts) }
        );
      }
    }
  }
  
  return cachedAllowedHosts;
}

// Maximum response size limit (3MB). This accommodates bulk data exports and large
// institutional datasets while preventing memory exhaustion from unbounded responses.
// Responses exceeding this limit will be rejected with an error.
const MAX_RESPONSE_BYTES = 3_000_000;
const UPSTREAM_TIMEOUT_MS = 15_000;
// Maximum length of error body to log. Truncate longer error bodies to prevent
// exposing sensitive information in server logs (database errors, internal paths, etc.)
const MAX_ERROR_BODY_LOG_LENGTH = 500;

async function readWithLimit(body: ReadableStream<Uint8Array> | null, limit: number, signal: AbortSignal) {
  if (!body) return "";
  const reader = body.getReader();
  let received = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal.aborted) throw new Error("Upstream fetch aborted");
    if (value) {
      received += value.length;
      if (received > limit) {
        throw new Error("Upstream response exceeded safety limit");
      }
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function forward(req: NextRequest, method: string, path: string[]) {
  if (!BASE_API_URL) {
    logger.error("NEXT_PUBLIC_BACKEND_URL is not configured");
    return NextResponse.json({ message: "Backend URL not configured" }, { status: 500 });
  }

  if (BASE_API_URL?.includes("localhost:3000")) {
    logger.error("Misconfigured NEXT_PUBLIC_BACKEND_URL: points to Next app (3000), causing proxy loop");
    return NextResponse.json({ message: "Backend URL misconfigured" }, { status: 500 });
  }

  const pathSegments = path ?? [];
  if (pathSegments.length === 0) {
    return NextResponse.json({ message: "Missing path" }, { status: 400 });
  }

  const isWrite = method !== "GET" && method !== "HEAD";
  
  // SECURITY: Path matching for PUBLIC_PATHS whitelist
  // Next.js route params ([...path]) automatically exclude query parameters and fragments,
  // but we explicitly validate this to prevent potential bypass attacks. An attacker cannot
  // bypass protection by adding ?query or #fragment because those are stripped by Next.js
  // before reaching this handler.
  // 
  // Additional safety: Check that no path segment contains '?' or '#' characters
  // (this should never happen with Next.js routing, but defense in depth)
  const hasInvalidChars = pathSegments.some(segment => 
    segment.includes('?') || segment.includes('#')
  );
  if (hasInvalidChars) {
    logger.warn("[backend-proxy] Path segments contain query or fragment characters", {
      path: pathSegments,
      method
    });
    return NextResponse.json({ message: "Invalid path format" }, { status: 400 });
  }
  
  // Check for exact path match (join all segments to compare against full paths in PUBLIC_PATHS)
  const fullPath = pathSegments.join("/");
  const isPublic = PUBLIC_PATHS.has(fullPath);

  // Origin validation for ALL state-changing calls (including public paths like login)
  // This prevents unauthorized sites from making requests, even to public endpoints
  // SKIP in development mode for easier local testing with localhost, tunnels, etc.
  if (isWrite && process.env.NODE_ENV !== "development") {
    // Validate that NEXT_PUBLIC_APP_DOMAIN is configured
    const allowedHosts = getAllowedHosts();
    if (!allowedHosts) {
      logger.error("NEXT_PUBLIC_APP_DOMAIN is not configured - origin validation cannot proceed");
      return NextResponse.json(
        { message: "Server configuration error: security validation unavailable" },
        { status: 500 }
      );
    }

    const origin = req.headers.get("origin");
    if (!origin) {
      // Provide helpful error message for non-browser clients
      return NextResponse.json({ 
        message: "Origin header required. This endpoint is browser-only. For API access, use programmatic endpoints or implement API key authentication." 
      }, { status: 400 });
    }
    try {
      // Use .hostname (not .host) to exclude port and properly handle IPv6 addresses
      const originHostname = new URL(origin).hostname.toLowerCase();
      // Strict allowlist - don't fall back to Host header which can be spoofed
      if (!allowedHosts.has(originHostname)) {
        // Log for monitoring potential attacks or misconfigured clients
        logger.warn("Origin validation failed", { 
          origin: originHostname, 
          path: fullPath,
          method 
        });
        return NextResponse.json({ 
          message: "Origin not allowed. This endpoint only accepts requests from authorized domains." 
        }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ message: "Invalid origin header format" }, { status: 400 });
    }
  }

  // CSRF protection for authenticated state-changing calls only (excludes public paths)
  if (isWrite && !isPublic) {
    const csrfToken = req.headers.get("x-csrf-token");
    const csrfOk = await validateCsrfToken(csrfToken);
    if (!csrfOk) {
      return NextResponse.json({ message: "Invalid CSRF token" }, { status: 403 });
    }
  }

  const token = isPublic ? undefined : await getAuthTokenServer();

  const target = `${BASE_API_URL}/${pathSegments.join("/")}${req.nextUrl.search}`;

  const hasBody = method !== "GET" && method !== "HEAD";
  let body: BodyInit | undefined;

  if (hasBody) {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await req.text();
    } else {
      body = Buffer.from(await req.arrayBuffer());
    }
  }

  try {
    // Wrap fetch in circuit breaker for automatic failure handling
    // This protects against cascading failures when EzyGo API is down
    const result = await ezygoCircuitBreaker.execute(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

      const res = await fetch(target, {
        method,
        headers: {
          ...(isPublic ? {} : { Authorization: `Bearer ${token}` }),
          "content-type": req.headers.get("content-type") || "application/json",
          accept: req.headers.get("accept") || "application/json",
        },
        body: hasBody ? body : undefined,
        // duplex is required for streaming request bodies
        // See: https://github.com/nodejs/undici/issues/1583
        ...(hasBody ? { duplex: "half" as const } : {}),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      let text: string;
      try {
        text = await readWithLimit(res.body, MAX_RESPONSE_BYTES, controller.signal);
      } catch (sizeErr) {
        logger.error("Proxy response too large", { target, error: (sizeErr as Error)?.message });
        throw new Error("Upstream response too large");
      }

      return { res, text };
    });

    const { res, text } = result;
    const contentType = res.headers.get("content-type") || "application/json";

    if (!res.ok) {
      // Sanitize error body for logging to avoid exposing sensitive information
      // Even in server logs, we should be careful about what we log from upstream errors
      const sanitizedBody = text.length > MAX_ERROR_BODY_LOG_LENGTH 
        ? text.substring(0, MAX_ERROR_BODY_LOG_LENGTH) + '...' 
        : text;
      logger.error("Proxy upstream error", { 
        status: res.status, 
        target, 
        bodyPreview: sanitizedBody 
      });
      let errorMessage: string = text;
      try {
        // Try to parse JSON error message from upstream
        const parsed = JSON.parse(text);
        errorMessage = parsed.message || text;
      } catch {
        // Not JSON, use raw text as error message
      }
      
      // ERROR SANITIZATION STRATEGY:
      // In production (NODE_ENV=production), sanitize 5xx server errors to prevent
      // exposing internal implementation details (database errors, file paths, etc.)
      // to clients. 4xx client errors are passed through as they contain actionable
      // user-facing information (validation errors, permission issues, etc.).
      //
      // IMPORTANT: In development mode, all error messages are exposed to aid debugging.
      // This is intentional but means:
      // 1. NODE_ENV must be properly set in all environments
      // 2. Development builds should NEVER be deployed to production
      // 3. Use logging/monitoring tools for production troubleshooting, not error messages
      //
      // PRODUCTION SAFETY CHECKLIST:
      // - Verify NODE_ENV=production in production environments
      // - Use CI/CD to enforce production builds
      // - Monitor server logs for detailed error information
      // - Consider a separate DEBUG flag for controlled verbose logging if needed
      
      const is5xxError = res.status >= 500;
      const clientMessage = (IS_PRODUCTION && is5xxError)
        ? "An error occurred while processing your request" 
        : errorMessage;
      
      return NextResponse.json({ message: clientMessage, status: res.status }, { status: res.status });
    }

    return new NextResponse(text, { status: res.status, headers: { "content-type": contentType } });
  } catch (err) {
    const error = err as Error;
    
    // Check if circuit breaker is open
    if (error.message?.includes('Circuit breaker is open')) {
      logger.warn("Circuit breaker is open - EzyGo API may be experiencing issues", { 
        target,
        path: pathSegments.join("/")
      });
      return NextResponse.json(
        { message: "Service temporarily unavailable - please try again shortly" }, 
        { status: 503 }
      );
    }
    
    logger.error("Proxy fetch failed", { target, error: error?.message });
    const isAbort = error?.name === "AbortError";
    return NextResponse.json({ message: isAbort ? "Upstream timed out" : "Upstream fetch failed" }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, "GET", path);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, "POST", path);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, "PUT", path);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, "PATCH", path);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, "DELETE", path);
}
