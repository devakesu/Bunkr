import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isProduction = process.env.NODE_ENV === "production";
const enableSwInDev = process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV === "true";

const withSerwist = withSerwistInit({
  // Source TypeScript service worker implementation
  swSrc: "src/sw.ts",
  // Destination for the generated service worker.
  // NOTE:
  // - This file is generated at build time and MUST NOT be committed to version control.
  // - Ensure "public/sw.js" is listed in .gitignore so it is treated as a build artifact.
  // - The public/ directory contains both static assets (checked in) and generated assets
  //   like this service worker; document this structure (e.g., in README.md or public/README.md)
  //   so team members understand which files are safe to edit/commit.
  swDest: "public/sw.js",
  // By default, service workers are disabled outside production to avoid caching issues during development.
  // To test PWA / offline functionality locally, start Next.js in development mode with NEXT_PUBLIC_ENABLE_SW_IN_DEV="true"
  // Example: NEXT_PUBLIC_ENABLE_SW_IN_DEV="true" npm run dev
  // This behavior should be documented in README.md for team members testing PWA features.
  disable: isProduction ? false : !enableSwInDev,
  // Ensure service worker is accessible at the root path for proper scope
  // This is critical for standalone builds where static files need explicit handling
  reloadOnOnline: true,
  cacheOnNavigation: true,
});

// Suppress Serwist Turbopack warning (Serwist doesn't support Turbopack yet)
process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

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