// Server-side Google Analytics 4 Measurement Protocol
// Replaces client-side gtag.js to avoid CSP issues with inline scripts

import { logger } from "@/lib/logger";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;
const GA_API_SECRET = process.env.GA_API_SECRET; // Server-only secret

interface GA4Event {
  name: string;
  params?: Record<string, any>;
}

interface GA4PageView {
  page_location: string;
  page_title?: string;
  page_referrer?: string;
}

/**
 * Send event to GA4 via Measurement Protocol
 * Server-side only - bypasses CSP restrictions
 * 
 * @see https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
export async function trackGA4Event(
  clientId: string,
  events: GA4Event[],
  userProperties?: Record<string, { value: string }>
) {
  if (!GA_MEASUREMENT_ID || !GA_API_SECRET) {
    logger.warn("[GA4] Measurement ID or API Secret not configured");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    logger.info("[GA4] Skipping event in development:", events);
    return;
  }

  try {
    const payload = {
      client_id: clientId,
      events: events,
      user_properties: userProperties,
    };

    // Note: GA_API_SECRET is included in the URL query string as per GA4 Measurement Protocol specification.
    // While this means the secret may be logged by proxies, load balancers, or monitoring tools,
    // this is the documented approach for the GA4 Measurement Protocol API.
    // The API secret provides minimal security value as it's intended for spam prevention, not authentication.
    // For improved security in production environments, ensure logging/monitoring solutions are configured
    // to not log full URLs for this endpoint, or consider using a reverse proxy to strip query parameters.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        logger.error("[GA4] Failed to send event:", response.statusText);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    logger.error("[GA4] Error sending event:", error);
  }
}

/**
 * Track page view via Measurement Protocol
 */
export async function trackPageView(
  clientId: string,
  pageData: GA4PageView,
  userId?: string
) {
  await trackGA4Event(
    clientId,
    [
      {
        name: "page_view",
        params: {
          page_location: pageData.page_location,
          page_title: pageData.page_title,
          page_referrer: pageData.page_referrer,
        },
      },
    ],
    userId ? { user_id: { value: userId } } : undefined
  );
}

/**
 * Generate or retrieve client ID (stored in cookie)
 * Client-side helper
 */
export function getOrCreateClientId(): string {
  if (typeof document === "undefined") return "";

  const cookieName = "_ga_client_id";
  // Use split-based lookup instead of RegExp to avoid regex injection risk
  const prefix = `${cookieName}=`;
  const pair = document.cookie.split('; ').find(c => c.startsWith(prefix));
  const existingId = pair ? pair.slice(prefix.length) : null;

  if (existingId) {
    return existingId;
  }

  // Generate new client ID: timestamp.random
  const clientId = `${Date.now()}.${Math.random().toString(36).substring(2, 11)}`;
  
  // Add Secure attribute in production to ensure cookie is only sent over HTTPS
  // Note: HttpOnly is intentionally omitted because this analytics client ID
  // must be readable from client-side code (via document.cookie). This means
  // the cookie is accessible to JavaScript and could be exposed via XSS, but
  // it does not contain authentication or other sensitive data.
  const isProd = process.env.NODE_ENV === "production";
  const secureAttr = isProd ? "; Secure" : "";
  document.cookie = `${cookieName}=${clientId}; path=/; max-age=63072000; SameSite=Lax${secureAttr}`; // 2 years
  
  return clientId;
}
