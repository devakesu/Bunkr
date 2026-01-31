"use client";

import { Toaster } from "sonner";
import { AcceptTermsForm } from "@/components/legal/AcceptTermsForm";
import { useCSRFToken } from "@/hooks/use-csrf-token";

export default function AcceptTermsPage() {
  // Initialize CSRF token for consistency with other form pages
  useCSRFToken();

  return (
    <>
      <Toaster richColors position="bottom-right" />
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-2xl">
          <AcceptTermsForm />
        </div>
      </div>
    </>
  );
}
