"use client";

import { Navbar } from "@/components/layout/private-navbar";
import { Footer } from "@/components/layout/footer";
import { Loading } from "@/components/loading";
import { useInstitutions } from "@/hooks/users/institutions";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import TermsModal from "@/components/legal/TermsModal";
import { motion, useScroll } from "framer-motion";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/error-boundary";
import { createClient } from "@/lib/supabase/client";
import { handleLogout } from "@/lib/security/auth";

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
  const supabaseRef = useRef(createClient());

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
    let active = true;

    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabaseRef.current.auth.getUser();
        if (error) throw error;

        if (!user) {
          active = false;
          router.replace("/");
          return;
        }

        if (active) setIsAuthorized(true);
      } catch (err) {
        if (active) {
          // Log the error for debugging, then attempt logout
          console.error("Auth check failed:", err instanceof Error ? err.message : String(err));
          try {
            await handleLogout();
          } catch (logoutErr) {
            // If logout also fails, force navigation to login page
            console.error("Logout failed after auth check error:", logoutErr instanceof Error ? logoutErr.message : String(logoutErr));
            router.replace("/");
          }
        }
      }
    };

    checkUser();
    
    return () => { 
      active = false;
    };
  }, [router]); // Removed supabase from dependencies to prevent re-runs

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
                <Toaster richColors position="bottom-right"/>
      </div>
    </ErrorBoundary>
  );
}