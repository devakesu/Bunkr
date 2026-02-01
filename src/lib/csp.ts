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
      style-src-elem 'self' 'unsafe-inline';
      style-src-attr 'unsafe-inline';
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

  // Use granular style directives for better XSS protection
  // style-src-elem: Controls <style> elements and <link> with rel="stylesheet"
  // We allow nonce'd styles plus specific hashes for library-injected CSS
  // Hashes for legitimate inline styles:
  // - sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY= : Sonner v2.0.7 toast CSS
  // - sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU= : Empty string (used by some libraries)
  // - sha256-441zG27rExd4/il+NvIqyL8zFx5XmyNQtE381kSkUJk= : Library inline styles
  // - sha256-AMd96FJ0GSrxFtEVT53SsztnJlpK57ZkVSOwhrM6Jjg= : Library inline styles
  // - sha256-DnU2FixQA4mFSjGuLz5b9dJ5ARj46/zX6IW2U4X4iIs= : Library inline styles
  const styleSrcElemParts = isDev
    ? ["'self'", "'unsafe-inline'"]
    : [
        "'self'", 
        `'nonce-${nonce}'`, 
        "'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY='",
        "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
        "'sha256-441zG27rExd4/il+NvIqyL8zFx5XmyNQtE381kSkUJk='",
        "'sha256-AMd96FJ0GSrxFtEVT53SsztnJlpK57ZkVSOwhrM6Jjg='",
        "'sha256-DnU2FixQA4mFSjGuLz5b9dJ5ARj46/zX6IW2U4X4iIs='"
      ];
  
  // style-src-attr: Controls inline style attributes (e.g., <div style="color: red;">)
  // Recharts and Sonner use inline style attributes for positioning/animations
  // This is a security tradeoff but safer than allowing arbitrary <style> injection
  const styleSrcAttrDirective = `style-src-attr 'unsafe-inline';`;
  
  // Fallback style-src for CSP Level 2 browsers (no style-src-elem/style-src-attr support)
  // Include nonce and all hashes for backwards compatibility
  const styleSrcParts = isDev
    ? ["'self'", "'unsafe-inline'"]
    : [
        "'self'", 
        `'nonce-${nonce}'`, 
        "'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY='",
        "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
        "'sha256-441zG27rExd4/il+NvIqyL8zFx5XmyNQtE381kSkUJk='",
        "'sha256-AMd96FJ0GSrxFtEVT53SsztnJlpK57ZkVSOwhrM6Jjg='",
        "'sha256-DnU2FixQA4mFSjGuLz5b9dJ5ARj46/zX6IW2U4X4iIs='"
      ];

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