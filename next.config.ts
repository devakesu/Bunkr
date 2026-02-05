import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isProduction = process.env.NODE_ENV === "production";
const enableSwInDev = process.env.ENABLE_SW_IN_DEV === "true";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // By default, disable service workers outside production.
  // To test PWA functionality in development, set ENABLE_SW_IN_DEV="true".
  disable: isProduction ? false : !enableSwInDev,
});

const nextConfig: NextConfig = {
  output: "standalone",

  async headers() {
    // 1. Define headers common to all environments
    const headersList = [
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
      // Cache fonts for 30 days (font files are not versioned/hashed, shorter cache prevents stale fonts)
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'framer-motion'],
    // Turbopack enabled by default in Next.js 15+
  },

  // Performance: Minimize JavaScript bundle
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn', 'log'], // Preserve console.log (used by logger.info()/logger.dev()), warn, and error
    } : false,
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

export default withSentryConfig(withSerwist(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});