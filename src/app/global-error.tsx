"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const handleRefresh = () => {
    // Try to reset the error boundary first
    try {
      reset();
    } catch {
      // Fallback to full page reload if reset fails
      window.location.reload();
    }
  };

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          backgroundColor: "#0a0a0a",
          color: "#fafafa"
        }}>
          <div style={{
            maxWidth: "600px",
            textAlign: "center",
            padding: "2rem",
            backgroundColor: "#18181b",
            borderRadius: "0.75rem",
            border: "1px solid #27272a"
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              marginBottom: "1rem",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.1)"
            }}>
              <AlertTriangle style={{ width: "24px", height: "24px", color: "#ef4444" }} aria-hidden="true" />
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "0.5rem" }}>
              Critical Error
            </h1>
            <p style={{ color: "#a1a1aa", marginBottom: "1.5rem" }}>
              We encountered a critical error. Please try refreshing the page.
            </p>
            <button
              onClick={handleRefresh}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.5rem 1.5rem",
                backgroundColor: "#0ea5e9",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: "500",
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#0284c7"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#0ea5e9"}
            >
              Refresh Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
