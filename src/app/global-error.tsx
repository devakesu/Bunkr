"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

/**
 * Global Error Handler
 * This is a last-resort error boundary that catches errors in the root layout.
 * Must render its own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        location: "global-error.tsx",
        digest: error.digest,
      },
    });
  }, [error]);

  const handleRefresh = () => {
    try {
      reset();
    } catch {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error - GhostClass</title>
        <style dangerouslySetInnerHTML={{__html: `
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
            color: #fafafa;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }
          .container {
            max-width: 600px;
            text-align: center;
            padding: 2.5rem;
            background: #18181b;
            border-radius: 1rem;
            border: 1px solid #27272a;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
          }
          .icon-wrapper {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 80px;
            height: 80px;
            background: rgba(239, 68, 68, 0.15);
            border-radius: 50%;
            margin-bottom: 1.5rem;
          }
          .icon {
            width: 40px;
            height: 40px;
            color: #ef4444;
          }
          h1 {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
            background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          p {
            color: #a1a1aa;
            margin-bottom: 2rem;
            line-height: 1.6;
          }
          .button-group {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            margin-top: 2rem;
          }
          button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            font-weight: 500;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            width: 100%;
          }
          .btn-primary {
            background: #a855f7;
            color: white;
          }
          .btn-primary:hover {
            background: #9333ea;
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(168, 85, 247, 0.3);
          }
          .btn-secondary {
            background: transparent;
            border: 1px solid #3f3f46;
            color: #fafafa;
          }
          .btn-secondary:hover {
            background: #27272a;
            border-color: #52525b;
          }
          .icon-small {
            width: 18px;
            height: 18px;
          }
          @media (min-width: 640px) {
            .button-group {
              flex-direction: row;
            }
            button {
              width: auto;
              min-width: 140px;
            }
          }
        `}} />
      </head>
      <body>
        <div className="container">
          <div className="icon-wrapper">
            <AlertTriangle className="icon" />
          </div>
          
          <h1>Critical Error</h1>
          
          <p>
            We encountered a critical error. This has been automatically reported to our team.
            You can try refreshing the page or return to the homepage.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <details style={{
              textAlign: 'left',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}>
              <summary style={{
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '0.875rem',
                color: '#ef4444',
                marginBottom: '0.5rem',
              }}>
                Error Details (Dev Only)
              </summary>
              <pre style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: '#fca5a5',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <div className="button-group">
            <button onClick={handleRefresh} className="btn-primary">
              <RefreshCcw className="icon-small" />
              Try Again
            </button>
            
            <button onClick={handleGoHome} className="btn-secondary">
              <Home className="icon-small" />
              Go Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
