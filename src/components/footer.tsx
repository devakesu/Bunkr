"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export const Footer = () => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); // initial
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="flex flex-col md:flex-row justify-center items-center gap-2 pb-5 pt-4 text-md lowercase opacity-80">
      <div className="text-white/85">
        <Button
          variant="outline"
          className="custom-button cursor-pointer"
          onClick={() => window.open(process.env.NEXT_PUBLIC_GITHUB_URL)}
        >
          Star on GitHub &nbsp; ⭐
        </Button>
      </div>

      <p className="text-[#6a6a6ae1] italic">
        <span className="inline-block font-mono">By</span>{" "}
        <span className="text-[#F90D2A] inline-block font-mono ml-1.5 font-medium">
          @deva.kesu (Credits zero-day)
        </span>
      </p>
    </div>
  );
};
