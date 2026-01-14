"use client";
import { Ring2 } from "ldrs/react";
import "ldrs/react/Ring2.css";
import { useState, useEffect } from "react";

export function Loading() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWarning(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full gap-8 p-8">
      {/* Spinner + Text Container */}
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <Ring2 size="45" stroke="4" speed="1" color="#3b82f6" />
        
        <div className="space-y-2">
          <p className="text-lg font-medium text-muted-foreground italic leading-relaxed">
            &quot;Waiting on Ezygo to stop ghosting us 👻&quot;
          </p>
        </div>
      </div>

      {showWarning && (
        <div className="text-center text-sm text-muted-foreground/80 animate-in fade-in duration-500">
          Site will not load if EzyGo is down.
        </div>
      )}
    </div>
  );
}
