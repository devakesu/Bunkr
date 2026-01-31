"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw, Home, Mail } from "lucide-react";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer";
import { getAppDomain } from "@/lib/utils";

/**
 * Custom Error Page for client-side errors
 * Catches errors that occur during rendering in client components
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error, {
      tags: {
        location: "error.tsx",
        digest: error.digest,
      },
    });
  }, [error]);

  const handleEmailReport = () => {
    const appDomain = getAppDomain();
    const subject = encodeURIComponent('Error Report - GhostClass');
    const body = encodeURIComponent(
      `Hi Admin,\n\nI encountered an error while using GhostClass.\n\n` +
      `Timestamp: ${new Date().toISOString()}\n\n` +
      `Note: Detailed error information has been automatically logged to our monitoring system.\n\n` +
      `Please help resolve this issue.\n\nThank you!`
    );

    window.location.href = `mailto:admin@${appDomain}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNavbar />
      
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center space-y-6 animate-in fade-in zoom-in duration-300">
          {/* Error Icon */}
          <div className="flex justify-center">
            <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
              <AlertTriangle className="h-12 w-12 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
          </div>

          {/* Error Message */}
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Something went wrong
            </h1>
            <p className="text-lg text-muted-foreground">
              We encountered an unexpected error
            </p>
          </div>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mx-auto max-w-lg">
              <details className="text-left bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg p-4">
                <summary className="cursor-pointer font-medium text-sm text-red-600 dark:text-red-400">
                  Error Details (Dev Only)
                </summary>
                <pre className="mt-2 text-xs font-mono text-red-700 dark:text-red-300 overflow-x-auto">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
            <Button
              onClick={reset}
              size="lg"
              className="gap-2 min-w-[180px]"
            >
              <RefreshCcw className="w-4 h-4" aria-hidden="true" />
              Try Again
            </Button>
            
            <Button
              onClick={() => router.push("/")}
              size="lg"
              variant="outline"
              className="gap-2 min-w-[180px]"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              Go Home
            </Button>

            <Button
              onClick={handleEmailReport}
              size="lg"
              variant="outline"
              className="gap-2 min-w-[180px]"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              Report Error
            </Button>
          </div>

          {/* Help Text */}
          <p className="text-sm text-muted-foreground pt-4">
            If the problem persists, please report the error or contact support.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
