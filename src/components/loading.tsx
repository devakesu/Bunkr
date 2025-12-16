"use client";
import { Ring2 } from "ldrs/react";
import "ldrs/react/Ring2.css";
import { useState, useEffect } from "react";

export function Loading() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Set a timer to show the warning after 8 seconds
    const timer = setTimeout(() => {
      setShowWarning(true);
    }, 5000);

    // Cleanup the timer if the component unmounts (e.g., loading finishes)
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full gap-4">
      {/* Spinner always shows */}
      <Ring2 size="35" stroke="3.5" speed="0.9" color="#d3e6e8" />

      {/* Text shows only after 5 seconds */}
      {showWarning && (
        <div className="text-center text-muted-foreground text-sm animate-in fade-in duration-500">
          Site will not load if EzyGo is down.
        </div>
      )}
    </div>
  );
}