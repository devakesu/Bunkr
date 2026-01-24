"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorFallback } from "@/components/error-fallback";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry with dashboard context
    Sentry.captureException(error, {
      tags: {
        location: "dashboard",
      },
    });
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
