// Content Security Policy
//
// CLOUDFLARE ZARAZ CSP INTEGRATION:
// Cloudflare Zaraz automatically modifies CSP headers to inject its own nonce for inline scripts.
// According to Cloudflare documentation (https://blog.cloudflare.com/zaraz-supports-csp/):
// - Zaraz adds its nonce ONLY IF: 'unsafe-inline' is NOT present, OR 'unsafe-inline' appears WITH nonces/hashes
// - If 'unsafe-inline' exists alone (no nonces), Zaraz will NOT modify the CSP header
// - When both nonce and 'unsafe-inline' exist, Zaraz appends its nonce, and CSP3 browsers ignore 'unsafe-inline'
//
// Our configuration uses nonce + 'unsafe-inline' in script-src-elem to:
// 1. Allow Zaraz to append its nonce (detected by presence of our nonce)
// 2. Provide fallback for non-CSP3 browsers (they use 'unsafe-inline')
// 3. Maintain strict security in modern browsers (nonce takes precedence, 'unsafe-inline' ignored)
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
      script-src 'self' 'unsafe-inline' blob: https://challenges.cloudflare.com https://static.cloudflareinsights.com;
      style-src 'self' 'unsafe-inline';
      style-src-elem 'self' 'unsafe-inline';
      style-src-attr 'unsafe-inline';
      img-src 'self' blob: data: ${supabaseOrigin};
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
        "https://challenges.cloudflare.com",
        "https://static.cloudflareinsights.com",
      ];

  // Use granular style directives for better XSS protection
  // style-src-elem: Controls <style> elements and <link> with rel="stylesheet"
  // We allow nonce'd styles plus specific hashes for library-injected CSS
  // 
  // CSP Style Hash Whitelist:
  // Each hash whitelists a specific inline <style> block. If any of these libraries update,
  // the corresponding hash must be recalculated. To calculate a new hash:
  // 1. Extract the CSS content from browser DevTools console error
  // 2. Run: echo -n "CSS_CONTENT" | openssl dgst -sha256 -binary | openssl base64 -A
  // 3. Add as 'sha256-BASE64_HASH'
  //
  // Current hashes:
  // - 'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY=' 
  //   → Sonner v2.0.7 toast library CSS injected via __insertCSS() 
  //   → See node_modules/sonner/dist/index.js
  //   → Contains toast animations, positioning, and styling (~7KB minified)
  //
  // - 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 
  //   → Empty string hash (SHA-256 of "")
  //   → Some libraries inject empty <style> tags as placeholders
  //   → Required for React components that dynamically create style elements
  //
  // - 'sha256-441zG27rExd4/il+NvIqyL8zFx5XmyNQtE381kSkUJk=' 
  //   → Recharts library inline styles for chart rendering
  //   → Used for SVG chart styling and animations
  //
  // - 'sha256-AMd96FJ0GSrxFtEVT53SsztnJlpK57ZkVSOwhrM6Jjg=' 
  //   → Next.js or React hydration inline styles
  //   → Used during client-side hydration to prevent FOUC
  //
  // - 'sha256-DnU2FixQA4mFSjGuLz5b9dJ5ARj46/zX6IW2U4X4iIs=' 
  //   → Additional library inline styles (possibly Framer Motion or shadcn/ui)
  //   → Used for animation transitions and component styling
  //
  // - 'sha256-nzTgYzXYDNe6BAHiiI7NNlfK8n/auuOAhh2t92YvuXo='
  //   → Login page or authentication component inline styles
  //   → Used for form animations or transitions
  const styleSrcElemParts = isDev
    ? ["'self'", "'unsafe-inline'"]
    : [
        "'self'", 
        `'nonce-${nonce}'`, 
        "'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY='", // Sonner toast CSS
        "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='", // Empty string
        "'sha256-441zG27rExd4/il+NvIqyL8zFx5XmyNQtE381kSkUJk='", // Recharts
        "'sha256-AMd96FJ0GSrxFtEVT53SsztnJlpK57ZkVSOwhrM6Jjg='", // Next.js/React hydration
        "'sha256-DnU2FixQA4mFSjGuLz5b9dJ5ARj46/zX6IW2U4X4iIs='", // Animation libraries
        "'sha256-nzTgYzXYDNe6BAHiiI7NNlfK8n/auuOAhh2t92YvuXo='"  // Login/auth inline styles
      ];
  
  // script-src-elem: Controls <script> elements specifically
  // Separate from script-src, which uses nonce + 'strict-dynamic' for dynamically loaded scripts
  // Here we intentionally avoid 'strict-dynamic' and instead rely on explicit host allowlisting
  // so that third-party scripts from Cloudflare and Google Tag Manager can load. In CSP3-compliant
  // browsers, combining 'strict-dynamic' with host-based sources would cause those host-based
  // sources to be ignored.
  //
  // IMPORTANT: 'unsafe-inline' is present as fallback for dynamic inline scripts injected by
  // Cloudflare Zaraz. In CSP3 browsers, 'unsafe-inline' is IGNORED when nonces are present,
  // maintaining strict security. It only applies to older browsers.
  //
  // NOTE: We use server-side GA4 Measurement Protocol API (/api/analytics/track) instead of
  // client-side gtag.js, eliminating the need for Google Analytics script domains. This approach:
  // - Avoids CSP violations from GTM's dynamic inline script injection
  // - Provides better privacy (no client-side tracking scripts)
  // - Is ad-blocker resistant (server-side requests)
  // - Maintains full GA4 feature parity via Measurement Protocol
  //
  // SECURITY TRADE-OFF:
  // - CSP3 browsers (modern): Strict nonce-only enforcement, 'unsafe-inline' ignored
  // - Non-CSP3 browsers (legacy): Allow inline scripts via 'unsafe-inline' for Cloudflare
  // - All browsers: External scripts from whitelisted hosts only
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;
  const scriptSrcElemParts = isDev
    ? ["'self'", "'unsafe-inline'"]
    : (() => {
        const parts = [
          "'self'",
          `'nonce-${nonce}'`,
          "'unsafe-inline'", // Must appear AFTER nonce to trigger Cloudflare Zaraz nonce injection (per Zaraz CSP docs)
                             // When nonce + 'unsafe-inline' coexist, Zaraz appends its nonce; nonce takes precedence in CSP3
          "https://challenges.cloudflare.com",
          "https://static.cloudflareinsights.com",
        ];

        if (appDomain) {
          parts.push(`https://${appDomain}/cdn-cgi/`); // Cloudflare CDN scripts
        } else {
          logger.warn(
            "[CSP] NEXT_PUBLIC_APP_DOMAIN is not set; skipping Cloudflare /cdn-cgi/ script allowlist entry in script-src-elem."
          );
        }

        return parts;
      })();
  
  // style-src-attr: Controls inline style attributes (e.g., <div style="color: red;">)
  // Recharts and Sonner use inline style attributes for positioning/animations
  // This is a security tradeoff but safer than allowing arbitrary <style> injection
  const styleSrcAttrDirective = `style-src-attr 'unsafe-inline';`;
  
  // Fallback style-src for CSP Level 2 browsers (no style-src-elem/style-src-attr support)
  // Include nonce and all hashes for backwards compatibility with older browsers
  // Modern browsers (CSP Level 3+) will ignore this in favor of style-src-elem/style-src-attr
  const styleSrcParts = isDev
    ? ["'self'", "'unsafe-inline'"]
    : [
        "'self'", 
        `'nonce-${nonce}'`, 
        "'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY='", // Sonner toast CSS
        "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='", // Empty string
        "'sha256-441zG27rExd4/il+NvIqyL8zFx5XmyNQtE381kSkUJk='", // Recharts
        "'sha256-AMd96FJ0GSrxFtEVT53SsztnJlpK57ZkVSOwhrM6Jjg='", // Next.js/React hydration
        "'sha256-DnU2FixQA4mFSjGuLz5b9dJ5ARj46/zX6IW2U4X4iIs='", // Animation libraries
        "'sha256-nzTgYzXYDNe6BAHiiI7NNlfK8n/auuOAhh2t92YvuXo='"  // Login/auth inline styles
      ];

  return `
    default-src 'self';
    script-src ${scriptSrcParts.join(" ")};
    script-src-elem ${scriptSrcElemParts.join(" ")};
    style-src ${styleSrcParts.join(" ")};
    style-src-elem ${styleSrcElemParts.join(" ")};${styleSrcAttrDirective ? `\n    ${styleSrcAttrDirective}` : ''}
    img-src 'self' blob: data: ${supabaseOrigin};
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
      https://challenges.cloudflare.com
      https://cloudflareinsights.com
      https://static.cloudflareinsights.com
      ${process.env.NODE_ENV !== 'production' ? 'ws://localhost:3000' : ''}
      ${process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : ''}
      ${process.env.NODE_ENV !== 'production' ? 'https://localhost:3000' : ';'}
    ${process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests;' : ''}
  `.replace(/\s{2,}/g, ' ').trim();
};