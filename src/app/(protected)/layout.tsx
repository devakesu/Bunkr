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
import { motion, useScroll } from "framer-motion";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/error-boundary";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const { scrollY } = useScroll();
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const previous = lastScrollY.current;
          const shouldHide = latest > previous && latest > 150;
          const shouldShow = latest <= previous || latest <= 150;
          
          if (shouldHide && !isHidden) {
            setIsHidden(true);
          } else if (shouldShow && isHidden) {
            setIsHidden(false);
          }
          
          lastScrollY.current = latest;
          ticking.current = false;
        });
        ticking.current = true;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [scrollY, isHidden]);

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

  if (!isAuthorized || institutionLoading || institutionError) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        
        <Footer />
        <Toaster richColors position="bottom-right" />
      </div>
    </ErrorBoundary>
  );
}