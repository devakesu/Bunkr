"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client"; 
import { User } from "@supabase/supabase-js";
import { Loader2, LayoutDashboard } from "lucide-react";

export function PublicNavbar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setLoading(false);
    };
    checkAuth();
  }, []);

  return (
    <nav 
      className="flex h-20 items-center justify-between gap-4 px-4 md:px-6 border-b border-white/10 bg-background"
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-2 h-full">
        <Link href="/" className="group h-full flex items-center" aria-label="GhostClass home">
          <div className="relative w-40 sm:w-64 md:w-80 h-20 overflow-hidden"> 
            <Image 
              src="/logo.png" 
              alt="GhostClass Logo"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
              placeholder="blur"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAICAYAAAD5nd/tAAAACXBIWXMAAAsTAAALEwEAmpwYAAACJklEQVR4nI2SzW/ScBjHi/NtTJg7bzHGyyKZBzXZ0YMaYzLjYbEHx/CiMjWLo5TaFhg/YbyVStlvvIQCg4VmYVZeu9LxIrAtJmYJB6/+NTXFYDx48JN88jx5Ds+TJ/kiyF88sQL90lp0Fl2LzuIsO6Wqqk4T0UR+q6qI7l9zZCSi+QedDeze2Nr58jyalVez1c7NxCBxRRMq8BIA6jlRRCdEEVwsttkppp4zgEHhMiqKE6Nl4yNjMBSbTPKlR6XGt91qd1jcOzp7tZGrP13Pyst4Wr5Hxru3iLh0x56uPcD36s/shQZq4+WHdqjcxlnFRMZq1wEUjMjohSF/QQiDuVKp8bJ18qPRO/tZy5a/xzaYprAebHfsvm6R8va5D76vSTxwJBIRueeIHPYdW63PhKcfpzwDxvOx9ZoNFBcQECtcDYVSd5P+yAshU+AqjcGB1BuGYaZPEq5mwUErJ7Sz3fS4emWXs1ujnc22yy2dut3yqZvutD3Ucc1LHx/4nR1XFOwvIoCGJv8mtIU2uTxkEvl0Sghm843lqL+6GMQqjwNYdTVIHJoZomWOkK2VsENa+WSvmFlb2cLisoUjehaO6Js5sn0/A4Q5hKUDJj/FvQFk1Aec2+/83p0lxpeaZ5icQeIlvQKhUQHQWGdyhjrDGLQqAGhUoGAUw/x0N8xPa70EeD0A4DySoqiZGMHMg/fsgtW6fe0ttT+DYeIkiqIT43j8r1psfgEIVTv/3/hdewAAAABJRU5ErkJggg==" 
              className="object-contain object-left transition-transform group-hover:scale-105"
            />
          </div>
        </Link>
      </div>
      
      <div className="flex gap-2 sm:gap-4 items-center">
         {loading ? (
           <div role="status" aria-live="polite">
             <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />
             <span className="sr-only">Loading user status...</span>
           </div>
         ) : user ? (
           <Link href="/dashboard">
              <Button className="gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
           </Link>
         ) : (
           <>
             <Link href="/">
                <Button variant="ghost">Login</Button>
             </Link>
             <Link href="/contact">
                <Button variant="ghost">Contact</Button>
             </Link>
             <Link href="/legal">
                <Button variant="ghost">Legal</Button>
             </Link>
           </>
         )}
      </div>
    </nav>
  );
}