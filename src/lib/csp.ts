// Content Security Policy
import { logger } from "@/lib/logger";

export const getCspHeader = (nonce?: string) => {
  const isDev = process.env.NODE_ENV !== "production";
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";

  // In production, nonce is mandatory for strict CSP enforcement
  if (!isDev && !nonce) {
    // Consolidate logging: explain the problem, troubleshooting steps, and fallback behavior
    logger.error(
      '[CSP] Nonce is required in production for secure CSP enforcement. ' +
      'Falling back to less secure CSP with unsafe-inline. This should not happen in production - investigate immediately. ' +
      'Troubleshooting: ' +
      '1. Verify middleware is generating nonce (check src/proxy.ts nonce generation) ' +
      '2. Ensure middleware is passing nonce via x-nonce header to downstream components ' +
      '3. Check that getCspHeader is called with the nonce parameter from headers ' +
      '4. Confirm middleware matcher includes the current route (see matcher config in src/proxy.ts)'
    );
    
    // Fallback CSP for production when nonce is missing (not recommended, but better than crashing)
    // This uses 'unsafe-inline' which is less secure than nonce-based CSP
    return `
      default-src 'self';
      script-src 'self' 'unsafe-inline' blob: https://www.googletagmanager.com https://challenges.cloudflare.com https://static.cloudflareinsights.com;
      style-src 'self' 'unsafe-inline';
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
        https://static.cloudflareinsights.com;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();
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
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        // Note: With 'strict-dynamic', explicitly listed host sources below are ignored
        // by modern browsers (CSP Level 3) and only apply to older browsers as fallback.
        // For modern browsers, external scripts must be loaded dynamically by nonce'd scripts.
        "https://www.googletagmanager.com",
        "https://challenges.cloudflare.com",
        "https://static.cloudflareinsights.com",
      ];

  // Use granular style directives instead of global unsafe-inline for better XSS protection
  const styleSrcElemParts = isDev
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", `'nonce-${nonce}'`];
  
  // style-src-attr allows inline style attributes (e.g., style="color: red;") used by some libraries like Recharts
  // In development: allow all inline styles for easier debugging
  // In production: omit directive entirely so inline style attributes are blocked (falls back to style-src which doesn't include 'unsafe-inline')
  // Note: This may break some third-party libraries that rely on inline styles without CSP support
  // If needed, consider using CSP3 unsafe-hashes or refactoring library usage
  const styleSrcAttrDirective = isDev ? `style-src-attr 'unsafe-inline';` : '';
  
  // Fallback style-src for CSP Level 2 browsers that don't support style-src-elem/style-src-attr
  // In production, we only include nonce to maintain security for Level 2 browsers
  // Level 2 browsers will need to upgrade or accept degraded functionality
  // Level 3 browsers will properly use style-src-elem (nonce) and style-src-attr (restricted)
  const styleSrcParts = isDev
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", `'nonce-${nonce}'`];

  return `
    default-src 'self';
    script-src ${scriptSrcParts.join(" ")};
    style-src ${styleSrcParts.join(" ")};
    style-src-elem ${styleSrcElemParts.join(" ")};${styleSrcAttrDirective ? `\n    ${styleSrcAttrDirective}` : ''}
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