// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Set sample rate (usually lower in production, e.g., 0.1)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Only enable debug logs in development
  debug: process.env.NODE_ENV === "development",

  // Security: Handle PII carefully
  sendDefaultPii: false,

  beforeSend(event, hint) {
    // Filter out common network errors that don't indicate real issues
    const error = hint?.originalException;
    
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = String(error.message).toLowerCase();
      
      // Ignore aborted requests (common during hot reload, navigation, etc.)
      if (errorMessage.includes('aborted') || 
          errorMessage.includes('econnreset') ||
          errorMessage.includes('epipe') ||
          errorMessage.includes('client closed') ||
          errorMessage.includes('socket hang up')) {
        return null; // Don't send to Sentry
      }
    }
    
    // Scrub Authorization headers from all captured requests
    if (event.request && event.request.headers) {
      const headers = { ...event.request.headers };
      delete headers["authorization"];
      delete headers["cookie"];
      event.request.headers = headers;
    }
    return event;
  },
  
  release: process.env.NEXT_PUBLIC_GIT_COMMIT_SHA,
});
