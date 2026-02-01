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
  userProperties?: Record<string, any>
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

    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      logger.error("[GA4] Failed to send event:", response.statusText);
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
  const match = document.cookie.match(new RegExp(`${cookieName}=([^;]+)`));
  
  if (match) {
    return match[1];
  }

  // Generate new client ID: timestamp.random
  const clientId = `${Date.now()}.${Math.random().toString(36).substring(2, 11)}`;
  
  // Add Secure attribute in production to ensure cookie is only sent over HTTPS
  const isProd =
    typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production";
  const secureAttr = isProd ? "; Secure" : "";
  document.cookie = `${cookieName}=${clientId}; path=/; max-age=63072000; SameSite=Lax${secureAttr}`; // 2 years
  
  return clientId;
}
