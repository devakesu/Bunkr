"use client";

import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "sonner";
import { useState, useRef } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { ErrorBoundary } from "@/components/error-boundary";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- SMART NAVBAR STATE ---
  const [isHidden, setIsHidden] = useState(false);
  const { scrollY } = useScroll();
  const lastScrollY = useRef(0);

  // --- SCROLL LOGIC ---
  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = lastScrollY.current;
    if (latest > previous && latest > 150) {
      setIsHidden(true);
    } else {
      setIsHidden(false);
    }
    lastScrollY.current = latest;
  });

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
          className="fixed top-0 left-0 right-0 z-50"
        >
          <PublicNavbar />
        </motion.div>

        <main className="flex-1 w-full pt-20">
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