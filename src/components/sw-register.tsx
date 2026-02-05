"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Service Worker Registration Component
 * 
 * Handles registration and lifecycle management of the service worker
 * for Progressive Web App (PWA) functionality including offline support,
 * caching strategies, and background sync.
 * 
 * This component should be included in the root layout to ensure the
 * service worker is registered on all pages.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register service worker in browser environment
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Wait for page to load before registering to avoid impacting initial page load performance
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        logger.dev("Service worker registered successfully", {
          context: "ServiceWorkerRegister",
          scope: registration.scope,
        });

        // Listen for updates to the service worker
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New service worker is available
              logger.dev("New service worker available", {
                context: "ServiceWorkerRegister",
              });
              
              // Optionally notify user about update
              // For now, we use skipWaiting: false in sw.ts to prevent automatic updates
              // Users can refresh to get the new version
            }
          });
        });

        // Check for updates periodically (every hour)
        setInterval(() => {
          registration.update().catch((error) => {
            logger.dev("Service worker update check failed", {
              context: "ServiceWorkerRegister",
              error,
            });
          });
        }, 60 * 60 * 1000);
      } catch (error) {
        logger.error("Service worker registration failed", {
          context: "ServiceWorkerRegister",
          error,
        });
      }
    });
  }, []);

  // This component doesn't render anything
  return null;
}
