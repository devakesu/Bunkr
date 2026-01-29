// Content Security Policy
import { logger } from './logger';

export const getCspHeader = (nonce?: string) => {
  const isDev = process.env.NODE_ENV !== "production";
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";

  // In production, nonce should always be provided for strict CSP enforcement
  if (!isDev && !nonce) {
    logger.error('[CSP] Nonce missing in production - CSP will use unsafe-inline fallback');
  }

  const scriptSrcParts = isDev
    ? [
        "'self'",
        "blob:",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://www.googletagmanager.com",
        "https://challenges.cloudflare.com",
        "https://static.cloudflareinsights.com",
      ]
    : [
        "'self'",
        "blob:",
        ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : ["'unsafe-inline'"]),
        // Note: With 'strict-dynamic', explicitly listed host sources below are ignored
        // by modern browsers (CSP Level 3) and only apply to older browsers as fallback.
        // For modern browsers, external scripts must be loaded dynamically by nonce'd scripts.
        "https://www.googletagmanager.com",
        "https://challenges.cloudflare.com",
        "https://static.cloudflareinsights.com",
      ];

  const styleSrcParts = isDev
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", ...(nonce ? [`'nonce-${nonce}'`] : ["'unsafe-inline'"])];

  return `
    default-src 'self';
    script-src ${scriptSrcParts.join(" ")};
    style-src ${styleSrcParts.join(" ")};
    img-src 'self' blob: data: ${supabaseOrigin} https://www.googletagmanager.com https://www.google-analytics.com https://*.google.com https://*.google.co.in https://*.doubleclick.net;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-src 'self' https://challenges.cloudflare.com;
    frame-ancestors 'none';
    worker-src 'self' blob:;
    connect-src 'self' 
      ${supabaseOrigin}
      https://production.api.ezygo.app
      https://*.ingest.sentry.io 
      https://*.google-analytics.com 
      https://*.analytics.google.com 
      https://analytics.google.com
      https://*.googletagmanager.com
      https://stats.g.doubleclick.net
      https://www.google-analytics.com
      https://challenges.cloudflare.com
      https://cloudflareinsights.com
      https://static.cloudflareinsights.com
      ${process.env.NODE_ENV !== 'production' ? 'ws://localhost:3000' : ''}
      ${process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : ''}
      ${process.env.NODE_ENV !== 'production' ? 'https://localhost:3000' : ';'}
    ${process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests;' : ''}
  `.replace(/\s{2,}/g, ' ').trim();
};