"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * DEVELOPMENT ONLY - Test page to verify error boundaries work correctly
 * This page allows testing error boundary functionality by intentionally throwing errors
 */
export default function TestErrorPage() {
  // Prevent access in production
  if (process.env.NODE_ENV === "production") {
    redirect("/dashboard");
  }

  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    // Intentionally throw an error to test error boundary
    throw new Error("This is a test error triggered by the user");
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Error Boundary Test Page</CardTitle>
          <CardDescription>
            This page is for development and testing purposes only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click the button below to trigger an error and test the error boundary functionality.
          </p>
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
              ⚠️ Development Only
            </p>
            <p className="text-xs text-yellow-600/80 dark:text-yellow-500/80 mt-1">
              This page should only be used during development to verify error boundaries are working correctly.
            </p>
          </div>
          <Button
            onClick={() => setShouldThrow(true)}
            variant="destructive"
            className="w-full"
          >
            Trigger Error
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
