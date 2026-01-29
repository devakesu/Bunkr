"use client";

import { Ring2 } from "ldrs/react";
import "ldrs/react/Ring2.css";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { handleLogout } from "@/lib/security/auth";

export function Loading() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWarning(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen w-full gap-8 p-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading application, please wait...</span>
      {/* Spinner + Text Container */}
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <Ring2 size="45" stroke="4" speed="1" color="#3b82f6" aria-hidden="true" />
        
        <div className="space-y-2">
          <p className="text-lg font-medium text-muted-foreground italic leading-relaxed">
            &quot;Waiting on Ezygo to stop ghosting us 👻&quot;
          </p>
        </div>
      </div>

      {showWarning && (
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
          {/* Text Group with gap */}
          <div className="flex flex-col gap-20">
            <div className="text-center text-sm text-muted-foreground/80">
              The site will not load if EzyGo is down.
            </div>
            <div className="text-center text-sm text-muted-foreground/80">
              Taking too long ({">"} 1 min)?
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLogout}
            className="gap-2"
            aria-label="Sign out and return to login page"
          >
            <LogOut className="h-4 w-4" />
            Logout & Try Again
          </Button>
        </div>
      )}
    </div>
  );
}