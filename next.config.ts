import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'standalone',
    env: {
    // This makes the variable available to the client-side
    NEXT_PUBLIC_GIT_COMMIT_SHA: process.env.SOURCE_COMMIT || "dev",
  },
};

export default nextConfig;
