// API Route for server-side Google Analytics tracking
// POST /api/analytics/track

import { NextRequest, NextResponse } from "next/server";
import { trackGA4Event } from "@/lib/analytics";
import { syncRateLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: default 10 requests per 10 seconds per IP
    // (configurable via RATE_LIMIT_REQUESTS and RATE_LIMIT_WINDOW)
    const ip = getClientIp(req.headers);
    
    if (!ip) {
      return NextResponse.json(
        { error: "Unable to determine client IP" },
        { status: 400 }
      );
    }
    
    const rateLimitResult = await syncRateLimiter.limit(ip);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { clientId, events, userProperties } = body;

    // Validate clientId format and type
    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json(
        { error: "Invalid clientId" },
        { status: 400 }
      );
    }
    
    // Validate clientId format (timestamp.random pattern) and length
    if (clientId.length > 100 || !/^\d+\.[a-z0-9]+$/.test(clientId)) {
      return NextResponse.json(
        { error: "Invalid clientId format" },
        { status: 400 }
      );
    }

    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Validate event structure and sanitize
    const maxEventNameLength = 40; // GA4 limit
    const maxParamKeyLength = 40;  // GA4 limit
    const maxParamValueLength = 100; // GA4 limit
    const maxEventsPerRequest = 25; // GA4 limit
    
    if (events.length > maxEventsPerRequest) {
      return NextResponse.json(
        { error: `Too many events. Maximum ${maxEventsPerRequest} events per request` },
        { status: 400 }
      );
    }
    
    const sanitizedEvents = events.map((event: any) => {
      if (!event.name || typeof event.name !== 'string') {
        throw new Error('Invalid event name');
      }
      
      // Validate event name format (lowercase, underscores, numbers)
      const eventName = event.name.slice(0, maxEventNameLength);
      if (!/^[a-z0-9_]+$/.test(eventName)) {
        throw new Error(`Invalid event name format: ${eventName}`);
      }
      
      // Sanitize event parameters
      const sanitizedParams: Record<string, any> = {};
      if (event.params && typeof event.params === 'object') {
        for (const [key, value] of Object.entries(event.params)) {
          const sanitizedKey = key.slice(0, maxParamKeyLength);
          
          // Only allow string, finite number, boolean values
          if (typeof value === 'string') {
            sanitizedParams[sanitizedKey] = value.slice(0, maxParamValueLength);
          } else if (typeof value === 'number' && Number.isFinite(value)) {
            sanitizedParams[sanitizedKey] = value;
          } else if (typeof value === 'boolean') {
            sanitizedParams[sanitizedKey] = value;
          }
        }
      }
      
      return {
        name: eventName,
        params: sanitizedParams,
      };
    });

    // Validate and sanitize userProperties
    let sanitizedUserProperties: Record<string, { value: string }> | undefined;
    if (userProperties !== undefined && userProperties !== null) {
      if (typeof userProperties !== 'object' || Array.isArray(userProperties)) {
        return NextResponse.json(
          { error: "Invalid userProperties format" },
          { status: 400 }
        );
      }
      
      sanitizedUserProperties = {};
      const maxUserPropertyKeyLength = 24; // GA4 limit
      const maxUserPropertyValueLength = 36; // GA4 limit
      
      for (const [key, value] of Object.entries(userProperties)) {
        const sanitizedKey = key.slice(0, maxUserPropertyKeyLength);
        
        // Only allow string values for user properties (GA4 requirement)
        if (typeof value === 'string') {
          sanitizedUserProperties[sanitizedKey] = { value: value.slice(0, maxUserPropertyValueLength) };
        } else if (typeof value === 'object' && value !== null && 'value' in value && typeof value.value === 'string') {
          // Already in GA4 format
          sanitizedUserProperties[sanitizedKey] = { value: value.value.slice(0, maxUserPropertyValueLength) };
        }
      }
    }

    // Send to GA4
    await trackGA4Event(clientId, sanitizedEvents, sanitizedUserProperties);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[Analytics API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
