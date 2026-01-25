"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Star, Coffee, ShieldCheck } from "lucide-react";
import Link from "next/link";

const isValidUrl = (urlString: string | undefined): boolean => {
  if (!urlString) return false;
  
  try {
    const url = new URL(urlString);
    // Only allow http and https protocols for security
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const Footer = ({ className }: { className?: string }) => {
  const commitSha = process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ?? "unknown";
  const shortSha = commitSha === "unknown" ? "dev-build" : commitSha.substring(0, 7);
  
  // Validate all external URLs from environment variables
  const donateUrlRaw = process.env.NEXT_PUBLIC_DONATE_URL;
  const githubUrlRaw = process.env.NEXT_PUBLIC_GITHUB_URL;
  const authorUrlRaw = process.env.NEXT_PUBLIC_AUTHOR_URL;
  
  const donateUrl = donateUrlRaw && isValidUrl(donateUrlRaw) ? donateUrlRaw : null;
  const githubUrl = githubUrlRaw && isValidUrl(githubUrlRaw) ? githubUrlRaw : null;
  const authorUrl = authorUrlRaw && isValidUrl(authorUrlRaw) ? authorUrlRaw : null;
  
  // Log validation warnings once on mount (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      if (donateUrlRaw && !donateUrl) {
        console.warn(
          `[Footer] Invalid NEXT_PUBLIC_DONATE_URL: "${donateUrlRaw}". ` +
          "Please ensure it's a valid HTTP/HTTPS URL. The donation button will not be displayed."
        );
      }
      if (githubUrlRaw && !githubUrl) {
        console.warn(
          `[Footer] Invalid NEXT_PUBLIC_GITHUB_URL: "${githubUrlRaw}". ` +
          "Please ensure it's a valid HTTP/HTTPS URL. GitHub-related links may not work correctly."
        );
      }
      if (authorUrlRaw && !authorUrl) {
        console.warn(
          `[Footer] Invalid NEXT_PUBLIC_AUTHOR_URL: "${authorUrlRaw}". ` +
          "Please ensure it's a valid HTTP/HTTPS URL. The author link may not work correctly."
        );
      }
    }
  }, [donateUrlRaw, donateUrl, githubUrlRaw, githubUrl, authorUrlRaw, authorUrl]);

  return (
    <footer className={cn(
      "w-full py-6 mt-12 border-t border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="container px-4 md:px-8 flex flex-col-reverse md:flex-row justify-between items-center gap-y-6 gap-x-4 text-sm">
        
        {/* Left Side: Credits, Author & Legal */}
        <div className="flex flex-col items-center md:items-start gap-3">
          <div className="flex items-center gap-2 text-muted-foreground flex-wrap justify-center md:justify-start">
            <span className="opacity-80">By</span>
            <a
              href={authorUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r hover:from-red-500 hover:to-orange-500 transition-all duration-300"
            >
              {process.env.NEXT_PUBLIC_AUTHOR_NAME}
            </a>
            
            <span className="text-muted-foreground/40 mx-1">·</span>
            
            <a
              href="https://github.com/ABHAY-100/Bunkr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Credits
            </a>

            <span className="text-muted-foreground/40 mx-1">·</span>
            
            <div className="flex gap-4">
              <Link 
                href="/legal"
                target="_blank"
                className="hover:text-foreground hover:underline underline-offset-4 transition-all"
              >
                Legal
              </Link>
              <Link 
                href="/contact"
                target="_blank"
                className="hover:text-foreground hover:underline underline-offset-4 transition-all"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>

        {/* Right Side: Actions & System Status */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-4">
          
          {/* Build Indicator (Sleeker Pill) */}
          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-mono text-muted-foreground hover:bg-primary/10 transition-colors cursor-help"
            title="This build is verified and traceable."
          >
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="opacity-70">ver</span>
              <a
                href={githubUrl ? `${githubUrl}/commit/${commitSha}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors font-semibold"
              >
                {shortSha}
              </a>
              <span className="opacity-30">/</span>
              <a
                href="/api/provenance"
                target="_blank"
                className="flex items-center gap-1 hover:text-emerald-500 transition-colors"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>secure</span>
              </a>
            </div>
          </div>

          <div className="hidden sm:block h-4 w-[1px] bg-border/60" />

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {donateUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full bg-background hover:bg-pink-500/10 hover:text-pink-500 hover:border-pink-500/20 transition-all group"
                onClick={() => window.open(donateUrl, "_blank")}
              >
                <Coffee className="w-3.5 h-3.5 mr-2 text-muted-foreground group-hover:text-pink-500 transition-colors" />
                <span className="text-xs font-medium">Buy Me a Coffee</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full bg-background hover:bg-yellow-500/10 hover:text-yellow-500 hover:border-yellow-500/20 transition-all group"
              onClick={() => githubUrl && window.open(githubUrl, "_blank")}
            >
              <Star className="w-3.5 h-3.5 mr-2 text-muted-foreground group-hover:text-yellow-500 transition-colors" />
              <span className="text-xs font-medium">Star</span>
            </Button>
          </div>

        </div>
      </div>
    </footer>
  );
};