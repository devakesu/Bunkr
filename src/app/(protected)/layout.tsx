"use client";

import { Navbar } from "@/components/layout/private-navbar";
import { Footer } from "@/components/layout/footer";
import { Loading } from "@/components/loading";
import { useInstitutions } from "@/hooks/users/institutions";
import { useEffect, useState, useRef } from "react";
import { getToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import TermsModal from "@/components/legal/TermsModal";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // --- SMART NAVBAR STATE ---
  const [isHidden, setIsHidden] = useState(false);
  const { scrollY } = useScroll();
  const lastScrollY = useRef(0);

  // --- SCROLL LOGIC ---
  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = lastScrollY.current;
    if (latest > previous && latest > 150) {
      setIsHidden(true); // Hide when scrolling down
    } else {
      setIsHidden(false); // Show when scrolling up
    }
    lastScrollY.current = latest;
  });

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
  if (!isAuthorized || institutionLoading || institutionError) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">

      <motion.div
        variants={{
          visible: { y: 0 },
          hidden: { y: "-100%" },
        }}
        animate={isHidden ? "hidden" : "visible"}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50",
          isHidden ? "pointer-events-none" : "pointer-events-auto"
        )}
      >
        <Navbar />
      </motion.div>

      <TermsModal />
      
      <main className="flex-1 w-full bg-background pt-20">
        {children}
      </main>
      
      <Footer />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}