"use client";

import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "sonner";
import { useState, useRef, useEffect } from "react";
import { motion, useScroll } from "framer-motion";
import { ErrorBoundary } from "@/components/error-boundary";
import { cn } from "@/lib/utils";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          <PublicNavbar />
        </motion.div>

        <main className="flex-1 w-full pt-20">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        
        <Footer />
        <Toaster 
          richColors 
          position="bottom-right" 
          toastOptions={{
            unstyled: false,
            classNames: {
              toast: 'toast-custom',
              title: 'toast-title',
              description: 'toast-description',
            },
          }}
        />
      </div>
    </ErrorBoundary>
  );
}