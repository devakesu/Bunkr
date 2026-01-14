"use client";

import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "sonner";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNavbar /> 
      
      <main className="flex-1 w-full">
        {children}
      </main>
      
      <Footer />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}