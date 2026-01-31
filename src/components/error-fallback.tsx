"use client";

import { AlertTriangle, Mail, RefreshCcw, Home } from "lucide-react";
import { useRouter } from "next/navigation";
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

  const handleEmailReport = () => {
    let appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;
    
    // Fallback to window.location.hostname if env var not set
    if (!appDomain && typeof window !== "undefined") {
      const hostname = window.location.hostname;
      
      // Check if hostname is a local development environment or IP address
      const localhostVariants = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
      const isLocalhost = localhostVariants.has(hostname);
      const isIPv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(hostname);
      // IPv6 addresses contain multiple colons; window.location.hostname never includes ports
      const isIPv6 = (hostname.match(/:/g) || []).length >= 2 || hostname.startsWith('[');
      
      if (hostname && !isLocalhost && !isIPv4 && !isIPv6) {
        appDomain = hostname;
      }
    }
    
    // Final fallback
    appDomain = appDomain || 'ghostclass.app';
    
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
    <div className="flex min-h-[400px] w-full items-center justify-center px-4 py-16">
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
        {(isDevelopment || showDetails) && (
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
            onClick={handleTryAgain}
            size="lg"
            className="gap-2 min-w-[180px]"
          >
            <RefreshCcw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </Button>
          
          <Button
            onClick={handleGoHome}
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
    </div>
  );
}
