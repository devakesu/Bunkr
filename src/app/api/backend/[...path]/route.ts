import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { getAuthTokenServer } from "@/lib/security/auth-cookie";
import { validateCsrfToken } from "@/lib/security/csrf";

const BASE_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "");
const PUBLIC_PATHS = new Set(["login"]);

// Validate NEXT_PUBLIC_APP_DOMAIN is set to prevent origin validation bypass
if (!process.env.NEXT_PUBLIC_APP_DOMAIN) {
  throw new Error("NEXT_PUBLIC_APP_DOMAIN must be configured for security");
}

const ALLOWED_HOSTS = new Set(
  [process.env.NEXT_PUBLIC_APP_DOMAIN]
    .filter(Boolean)
    .map((host) => host?.toLowerCase()) as string[]
);

// Additional safety check: ensure ALLOWED_HOSTS is not empty
// This is a defense-in-depth measure since NEXT_PUBLIC_APP_DOMAIN is already validated above
if (ALLOWED_HOSTS.size === 0) {
  throw new Error("ALLOWED_HOSTS is empty - check NEXT_PUBLIC_APP_DOMAIN configuration");
}

const MAX_RESPONSE_BYTES = 1_000_000; // 1 MB safety cap
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
    console.error("NEXT_PUBLIC_BACKEND_URL is not configured");
    return NextResponse.json({ error: "Backend URL not configured" }, { status: 500 });
  }

  if (BASE_API_URL?.includes("localhost:3000")) {
    console.error("Misconfigured NEXT_PUBLIC_BACKEND_URL: points to Next app (3000), causing proxy loop");
    return NextResponse.json({ error: "Backend URL misconfigured" }, { status: 500 });
  }

  const pathSegments = path ?? [];
  if (pathSegments.length === 0) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const isWrite = method !== "GET" && method !== "HEAD";

  // CSRF + Origin protection for state-changing calls
  if (isWrite) {
    const origin = req.headers.get("origin");
    if (!origin) {
      return NextResponse.json({ error: "Origin required" }, { status: 400 });
    }
    try {
      const originHost = new URL(origin).host.toLowerCase();
      // Remove port from comparison to avoid false rejections
      const originHostNoPort = originHost.split(':')[0];
      // Strict allowlist - don't fall back to Host header which can be spoofed
      // Check both with and without port for flexibility
      if (!ALLOWED_HOSTS.has(originHostNoPort) && !ALLOWED_HOSTS.has(originHost)) {
        return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid origin" }, { status: 400 });
    }

    const csrfOk = await validateCsrfToken(req as unknown as Request);
    if (!csrfOk) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }
  }

  const isPublic = PUBLIC_PATHS.has(pathSegments[0]);
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
      // TypeScript doesn't recognize duplex as a valid option, but it's required for streaming requests
      ...(hasBody ? { duplex: "half" as const } : {}),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let text: string;
    try {
      text = await readWithLimit(res.body, MAX_RESPONSE_BYTES, controller.signal);
    } catch (sizeErr) {
      console.error("Proxy response too large", { target, error: (sizeErr as Error)?.message });
      return NextResponse.json({ error: "Upstream response too large" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") || "application/json";

    if (!res.ok) {
      console.error("Proxy upstream error", { status: res.status, target, body: text });
      return NextResponse.json({ error: "Upstream error", status: res.status }, { status: res.status });
    }

    return new NextResponse(text, { status: res.status, headers: { "content-type": contentType } });
  } catch (err: any) {
    console.error("Proxy fetch failed", { target, error: err?.message });
    const isAbort = err?.name === "AbortError";
    return NextResponse.json({ error: isAbort ? "Upstream timed out" : "Upstream fetch failed" }, { status: 502 });
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