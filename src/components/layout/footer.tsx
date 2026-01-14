"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import Link from "next/link";

export const Footer = ({ className }: { className?: string }) => {
  const commitSha = process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ?? "unknown";
  const shortSha = commitSha ? commitSha.substring(0, 7) : "dev";

 return (
    <footer className={cn(
      "w-full py-6 mt-12 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="container px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6 text-sm">
        {/* Left Side: Credits, Author & Legal */}
        <div className="flex items-center gap-2 text-muted-foreground italic flex-wrap justify-center md:justify-start">
          <span className="font-mono opacity-70">By</span>
          <a
            href={`${process.env.NEXT_PUBLIC_AUTHOR_URL}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F90D2A] font-mono font-medium hover:underline transition-all hover:opacity-80"
          >
            {process.env.NEXT_PUBLIC_AUTHOR_NAME}
          </a>
          
          <span className="text-border/60 mx-1">|</span>
          
          <span className="opacity-70">Credits</span>
          <a
            href="https://github.com/ABHAY-100/Bunkr"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-foreground transition-colors"
          >
            Bunkr
          </a>

          <span className="text-border/60 mx-1">|</span>
          <Link 
            href="/legal"
            target="_blank"
            className="opacity-70 hover:opacity-100 hover:text-foreground hover:underline transition-all"
          >
            Legal
          </Link>
          <span className="text-border/60 mx-1">|</span>
          <Link 
            href="/contact"
            target="_blank"
            className="opacity-70 hover:opacity-100 hover:text-foreground hover:underline transition-all"
          >
            Contact
          </Link>
        </div>

        {/* Right Side: Actions & System Status */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          
          {/* Star Button (Glassy Look) */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-border/50 bg-background/50 hover:bg-accent hover:text-accent-foreground transition-all group"
            onClick={() => window.open(process.env.NEXT_PUBLIC_GITHUB_URL, "_blank")}
          >
            <Star className="w-3.5 h-3.5 mr-2 text-muted-foreground group-hover:text-yellow-500 transition-colors" />
            <span>Star on GitHub</span>
          </Button>

          {/* Separator (Hidden on mobile) */}
          <div className="hidden md:block h-4 w-[1px] bg-border/50" />

          {/* Live Build / Integrity Indicator */}
          <div
            className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-accent/30 border border-border/40"
            title="This build is traceable to a public GitHub Actions workflow and signed container image. Click verify for details."
          >
            {/* Pulse */}
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>

            {/* Build Info */}
            <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              <span>Build:</span>

              {/* Commit SHA */}
              <a
                href={`${process.env.NEXT_PUBLIC_GITHUB_URL}/commit/${commitSha}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline hover:text-primary transition-colors"
              >
                {shortSha}
              </a>

              {/* Verify link */}
              <span className="opacity-60">·</span>
              <a
                target="_blank"
                href="/api/provenance"
                className="lowercase text-muted-foreground hover:text-primary transition-colors"
              >
                verify
              </a>
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
};