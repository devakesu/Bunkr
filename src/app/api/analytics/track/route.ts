// API Route for server-side Google Analytics tracking
// POST /api/analytics/track

import { NextRequest, NextResponse } from "next/server";
import { trackGA4Event } from "@/lib/analytics";
import { syncRateLimiter } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 100 events per minute per IP
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimitResult = await syncRateLimiter.limit(ip);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { clientId, events, userProperties } = body;

    if (!clientId || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Send to GA4
    await trackGA4Event(clientId, events, userProperties);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Analytics API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
