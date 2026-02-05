/// <reference lib="webworker" />

import { Serwist } from "serwist";
// Strategy classes for different caching behaviors
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "serwist";
// Plugins used specifically for the image runtime caching strategy
import { CacheableResponsePlugin, ExpirationPlugin } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: Array<{
    url: string;
    revision?: string;
  }>;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Wait for all clients to close before activating new service worker
  // This prevents breaking changes from affecting active users
  skipWaiting: false,
  // Don't take control immediately to allow graceful updates
  clientsClaim: false,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.destination === "document",
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 5,
      }),
    },
    {
      matcher: ({ request }) =>
        request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "worker",
      handler: new StaleWhileRevalidate({
        cacheName: "assets",
      }),
    },
    {
      matcher: ({ request }) => request.destination === "image",
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          }),
        ],
      }),
    },
    {
      // API caching strategy: NetworkFirst for cacheable GET /api requests.
      // - Mutation endpoints (POST/PUT/PATCH/DELETE) are excluded by the GET check
      //   and will always go through the network without caching.
      // - Certain time-sensitive endpoints are explicitly excluded to avoid stale data.
      // - No explicit network timeout is used here to avoid serving stale cache for
      //   legitimately long-running operations (e.g., reports, bulk operations).
      matcher: ({ request, url }) => {
        if (request.method !== "GET") {
          return false;
        }
        if (!url.pathname.startsWith("/api/")) {
          return false;
        }
        // Exclude known time-sensitive or user-specific endpoints from caching
        const uncachedPrefixes = [
          "/api/user-settings",
          "/api/attendance",
          "/api/realtime",
        ];
        if (uncachedPrefixes.some((path) => url.pathname.startsWith(path))) {
          return false;
        }
        return true;
      },
      handler: new NetworkFirst({
        cacheName: "api",
      }),
    },
  ],
});

serwist.addEventListeners();

// Allow manual skip waiting via postMessage for user-initiated updates
// This enables a "New version available - Click to refresh" UI pattern
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
