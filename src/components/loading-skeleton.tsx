"use client";

import { Ring2 } from "ldrs/react";
import "ldrs/react/Ring2.css";

/**
 * Lightweight loading skeleton for code-splitting fallbacks.
 * Displays a simple spinner without any destructive actions.
 * 
 * Use this component for:
 * - Suspense fallbacks during dynamic imports
 * - Page transitions with lazy-loaded components
 * - Any loading state where logout would be inappropriate
 * 
 * For authentication-related loading states, use the Loading component instead.
 * 
 * @example
 * ```tsx
 * <Suspense fallback={<LoadingSkeleton />}>
 *   <DynamicComponent />
 * </Suspense>
 * ```
 */
export function LoadingSkeleton() {
  return (
    <div 
      className="flex items-center justify-center min-h-screen w-full"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading, please wait...</span>
      <Ring2 size="45" stroke="4" speed="1" color="#3b82f6" aria-hidden="true" />
    </div>
  );
}
