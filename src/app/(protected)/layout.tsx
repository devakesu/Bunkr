"use client";

import { Navbar } from "@/components/layout/private-navbar";
import { Footer } from "@/components/layout/footer";
import { Loading } from "@/components/loading";
import { useInstitutions } from "@/hooks/users/institutions";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import TermsModal from "@/components/legal/TermsModal";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const { error: institutionError, isLoading: institutionLoading } = useInstitutions();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getToken();
      if (!token) {
        router.replace("/");
      } else {
        setIsAuthorized(true);
      }
    };
    checkAuth();
  }, [router]);

  // Show loading screen while checking auth or fetching initial data
  if (!isAuthorized || institutionLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (institutionError) {
    router.replace("/");
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <TermsModal />
      <main className="flex-1 w-full bg-background">
        {children}
      </main>
      
      <Footer />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}