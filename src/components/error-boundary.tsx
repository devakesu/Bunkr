"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCcw, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 1. Log to console with environment-aware detail level
    if (process.env.NODE_ENV !== "production") {
      // In non-production, log full error details for easier debugging
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    } else {
      // In production, avoid logging potentially sensitive details to the console
      console.error("ErrorBoundary caught an error. Full details have been reported to monitoring.");
    }

    // 2. Report error to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        boundary: "react_component_tree",
        location: "ErrorBoundary/componentDidCatch"
      }
    });

    // 3. Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Render custom fallback UI
      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback(this.state.error, this.resetError);
        }
        return this.props.fallback;
      }

      // Default Fallback UI (Tailwind + Lucide)
      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
          <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          
          <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Something went wrong
          </h2>
          
          <p className="text-sm text-muted-foreground max-w-[400px] mb-6">
            We encountered an unexpected error. You can try to recover the component or reload the page.
          </p>

          <div className="flex gap-3">
            <button
              onClick={this.resetError}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Try Again
            </button>
            
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reload Page
            </button>
          </div>
          
          {/* Optional: Show Error Message in Dev only if you want, 
              but usually hiding it is better for UX */}
          {process.env.NODE_ENV === 'development' && (
             <p className="mt-8 text-xs font-mono text-red-500 bg-red-50 dark:bg-red-950/50 p-2 rounded max-w-lg break-all">
                {this.state.error.toString()}
             </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}