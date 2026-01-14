import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// 🛡️ Content Security Policy (CSP)
const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://www.googletagmanager.com https://challenges.cloudflare.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: 
      ${process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ''} 
      https://www.googletagmanager.com 
      https://www.google-analytics.com
      https://*.google.com
      https://*.google.co.in;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-src 'self' https://challenges.cloudflare.com;
    frame-ancestors 'none';
    worker-src 'self' blob:;
    connect-src 'self' 
      ${process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ''}
      https://production.api.ezygo.app
      https://*.ingest.sentry.io 
      https://*.google-analytics.com 
      https://*.analytics.google.com 
      https://analytics.google.com
      https://*.googletagmanager.com
      https://stats.g.doubleclick.net
      https://www.google-analytics.com
      https://challenges.cloudflare.com
      ${process.env.NODE_ENV !== 'production' ? 'ws://localhost:3000' : ''}
      ${process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : ''}
      ${process.env.NODE_ENV !== 'production' ? 'https://localhost:3000' : ';'}
    ${process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests;' : ''}
`.replace(/\n/g, "").replace(/\s{2,}/g, " ").trim();

const nextConfig: NextConfig = {
  output: "standalone",

  async headers() {
    // 1. Define headers common to all environments
    const headersList = [
      {
        key: "Content-Security-Policy",
        value: cspHeader,
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    // 2. Only add HSTS in Production to prevent local SSL errors
    if (process.env.NODE_ENV === 'production') {
      headersList.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/(.*)",
        headers: headersList,
      },
    ];
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  
  generateBuildId: async () => {
    return process.env.APP_COMMIT_SHA ?? "dev";
  },

  env: {
    NEXT_PUBLIC_GIT_COMMIT_SHA: process.env.APP_COMMIT_SHA || "dev",
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : 'supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
});