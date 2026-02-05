// React Query provider
// src/providers/react-query.tsx

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { PropsWithChildren } from "react";
import { AttendanceSettingsProvider } from "./attendance-settings";

/**
 * React Query provider with pre-configured defaults for the application.
 * Wraps the app with QueryClientProvider and AttendanceSettingsProvider.
 * 
 * Query Configuration:
 * - Stale time: 3 minutes
 * - Garbage collection: 10 minutes
 * - Retry: 2 attempts
 * - Window focus refetch: Enabled (critical for cross-device sync)
 * - Auto refetch interval: 15 minutes
 * 
 * @param children - Child components to wrap
 * @returns Configured React Query provider with attendance settings
 * 
 * @example
 * ```tsx
 * <ReactQueryProvider>
 *   <App />
 * </ReactQueryProvider>
 * ```
 */
export default function ReactQueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 3 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 2,
            // Disable global window focus refetch to avoid performance issues
            // Enable it per-query for critical queries that need cross-device sync
            refetchOnWindowFocus: false,
            refetchInterval: 15 * 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AttendanceSettingsProvider>
        {children}
      </AttendanceSettingsProvider>
    </QueryClientProvider>
  );
}
