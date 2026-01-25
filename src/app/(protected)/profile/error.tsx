"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorFallback } from "@/components/error-fallback";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry with profile context
    Sentry.captureException(error, {
      tags: {
        location: "profile",
      },
    });
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
