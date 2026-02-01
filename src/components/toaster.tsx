"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Centralized Toaster component with consistent configuration across the app.
 * Uses Sonner's default styling with richColors and bottom-right positioning.
 */
export function Toaster() {
  return (
    <SonnerToaster 
      richColors 
      position="bottom-right"
    />
  );
}
