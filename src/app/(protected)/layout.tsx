"use client";

import { Navbar } from "@/components/layout/private-navbar";
import { Footer } from "@/components/layout/footer";
import { Loading } from "@/components/loading";
import { useInstitutions } from "@/hooks/users/institutions";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { motion, useScroll } from "framer-motion";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/error-boundary";
import { createClient } from "@/lib/supabase/client";
import { handleLogout } from "@/lib/security/auth";
import { logger } from "@/lib/logger";
import { useCSRFToken } from "@/hooks/use-csrf-token";

// Helper to check if error is related to missing auth session
const isAuthSessionMissingError = (error: any): boolean => {
  return error?.message?.toLowerCase().includes("session missing") ||
         error?.message?.toLowerCase().includes("auth session");
};


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

  // Initialize CSRF token
  useCSRFToken();

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
        // Handle auth session missing errors - redirect to login
        if (error) {
          if (isAuthSessionMissingError(error)) {
            active = false;
            router.replace("/");
            return;
          }
          throw error;
        }

        // If no Supabase user, redirect to public landing
        if (!user) {
          active = false;
          router.replace("/");
          return;
        }

        // At this point, Supabase has confirmed a valid user session.
        // The EzyGo access token cookie (ezygo_access_token) is HttpOnly and cannot be validated
        // from client-side JavaScript; it's automatically sent with API requests and validated
        // server-side. Any additional validation should occur on the server (e.g., via a server
        // action or API endpoint).

        if (active) setIsAuthorized(true);
      } catch (err) {
        if (active) {
          // Log the error for debugging, then attempt logout
          logger.error("Auth check failed:", err instanceof Error ? err.message : String(err));
          try {
            await handleLogout();
          } catch (logoutErr) {
            // If logout also fails, force navigation to login page
            logger.error("Logout failed after auth check error:", logoutErr instanceof Error ? logoutErr.message : String(logoutErr));
            router.replace("/");
          }
        }
      }
    };

    checkUser();
    
    return () => { 
      active = false;
    };
  }, [router]); 

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col">
        {(!isAuthorized || institutionLoading || institutionError) ? (
          <div className="h-screen flex items-center justify-center">
            <Loading />
          </div>
        ) : (
          <>

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
        
        <main className="flex-1 w-full bg-background pt-20">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        
        <Footer />
        <Toaster richColors position="bottom-right"/>
        </>
        )}
      </div>
    </ErrorBoundary>
  );
}