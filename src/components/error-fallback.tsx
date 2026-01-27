"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorFallbackProps {
  error: Error;
  reset?: () => void;
  showDetails?: boolean;
  homeUrl?: string;
}

/**
 * ErrorFallback component that displays a user-friendly error message
 * with options to try again or go back to the dashboard.
 */
export function ErrorFallback({ error, reset, showDetails, homeUrl = "/dashboard" }: ErrorFallbackProps) {
  const router = useRouter();
  const isDevelopment = process.env.NODE_ENV === "development";

  const handleGoHome = () => {
    router.push(homeUrl);
  };

  const handleTryAgain = () => {
    if (reset) {
      reset();
    } else {
      // Fallback to page refresh if reset function is not provided
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-[400px] w-full items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            We&apos;re sorry for the inconvenience. An unexpected error occurred while loading this page.
          </p>

          {(isDevelopment || showDetails) && (
            <div className="rounded-lg bg-muted p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">
                Error Details:
              </p>
              <div className="space-y-2">
                <p className="font-mono text-xs text-foreground">
                  <span className="font-semibold">Name:</span> {error.name}
                </p>
                <p className="font-mono text-xs text-foreground">
                  <span className="font-semibold">Message:</span> {error.message}
                </p>
                {error.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-foreground hover:text-foreground/80">
                      Stack Trace
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 font-mono text-xs text-foreground">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={handleTryAgain} variant="default">
              Try Again
            </Button>
            <Button onClick={handleGoHome} variant="outline">
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
