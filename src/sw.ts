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
  skipWaiting: true,
  clientsClaim: true,
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
      // API caching strategy: NetworkFirst with 3-second timeout
      // - GET requests are cached for offline support and fast loading
      // - 3-second timeout provides balance between fresh data and offline resilience
      // - For slow networks, falls back to cache after timeout to maintain UX
      // Note: Mutation endpoints (POST/PUT/PATCH/DELETE) are excluded by the GET check
      // and will always go through the network without caching
      // 
      // TIMEOUT RATIONALE: 3 seconds is appropriate for most API endpoints in this application.
      // Data-heavy operations (reports, analytics) should ideally be optimized at the backend level.
      // If specific endpoints consistently need more time, consider implementing endpoint-specific
      // caching strategies or backend optimizations rather than increasing this global timeout.
      matcher: ({ request, url }) =>
        request.method === "GET" && url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "api",
        networkTimeoutSeconds: 3,
      }),
    },
  ],
});

serwist.addEventListeners();
