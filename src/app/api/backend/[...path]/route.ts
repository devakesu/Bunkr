import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { getAuthTokenServer } from "@/lib/security/auth-cookie";
import { validateCsrfToken } from "@/lib/security/csrf";
import { logger } from "@/lib/logger";

const BASE_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "");

// PUBLIC_PATHS: Exact endpoints that are exempt from both CSRF and origin validation.
// Uses full path matching (not prefix) to prevent accidentally exposing sensitive sub-paths.
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

const MAX_RESPONSE_BYTES = 3_000_000;
const UPSTREAM_TIMEOUT_MS = 15_000;

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
  if (isWrite) {
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
      return NextResponse.json({ message: "Origin required" }, { status: 400 });
    }
    try {
      // Use .hostname (not .host) to exclude port and properly handle IPv6 addresses
      const originHostname = new URL(origin).hostname.toLowerCase();
      // Strict allowlist - don't fall back to Host header which can be spoofed
      if (!allowedHosts.has(originHostname)) {
        return NextResponse.json({ message: "Origin not allowed" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ message: "Invalid origin" }, { status: 400 });
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
      return NextResponse.json({ message: "Upstream response too large" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") || "application/json";

    if (!res.ok) {
      logger.error("Proxy upstream error", { status: res.status, target, body: text });
      let errorMessage: string = text; // Default to raw text
      try {
        // Try to parse JSON error message from upstream
        const parsed = JSON.parse(text);
        errorMessage = parsed.message || text;
      } catch {
        // Not JSON, keep raw text as error message
      }
      
      // In production, sanitize error messages to avoid exposing internal details
      // Log full details server-side but return generic messages to client
      const isProduction = process.env.NODE_ENV === "production";
      const clientMessage = isProduction 
        ? "An error occurred while processing your request" 
        : errorMessage;
      
      return NextResponse.json({ message: clientMessage, status: res.status }, { status: res.status });
    }

    return new NextResponse(text, { status: res.status, headers: { "content-type": contentType } });
  } catch (err) {
    const error = err as Error;
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
