"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useNotifications } from "@/hooks/notifications/useNotifications";
import { useUser } from "@/hooks/users/user";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCheck, 
  BellOff, 
  ArrowLeft, 
  Loader2, 
  RefreshCcw, 
  AlertTriangle, 
  Info, 
  CalendarClock
} from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: number;
  topic?: string;
  is_read: boolean;
  title: string;
  description?: string;
  created_at: string;
}

const getNotificationIcon = (topic?: string) => {
  if (topic?.includes("sync")) {
    return { icon: RefreshCcw, color: "text-green-500", bg: "bg-green-500/10" };
  }
  if (topic?.includes("conflict")) {
    return { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" };
  }
  if (topic?.includes("attendance")) {
    return { icon: CalendarClock, color: "text-blue-500", bg: "bg-blue-500/10" };
  }
  return { icon: Info, color: "text-primary", bg: "bg-primary/10" };
};

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  
  const scrollTrigger = useRef<HTMLDivElement>(null);

  const { 
    notifications = [],
    isLoading, 
    markAsRead, 
    markAllAsRead,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useNotifications(true);

  const [readingId, setReadingId] = useState<number | null>(null);

  // Safe calculation of unread count
  const unreadCount = Array.isArray(notifications) 
    ? notifications.filter((n: NotificationItem) => !n.is_read).length 
    : 0;

  // --- INFINITE SCROLL ---
  useEffect(() => {
    if (!scrollTrigger.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: "100px"
      }
    );

    observer.observe(scrollTrigger.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // --- SYNC ON MOUNT ---
  useEffect(() => {
    if (user?.username) {
        fetch(`/api/cron/sync?username=${user.username}`)
        .then(async (res) => {
            const data = await res.json();
            if (data.success && (data.deletions > 0 || data.conflicts > 0 || data.updates > 0)) {
                toast.info("Notifications Updated", { description: "New attendance data found." });
                queryClient.invalidateQueries({ queryKey: ["notifications"] });
            }
        })
        .catch(err => console.error("Sync failed", err));
    }
  }, [user?.username, queryClient]);

  const handleMarkRead = useCallback(async (id: number) => {
    if (readingId === id) return;
    setReadingId(id);
    try {
      await markAsRead(id);
    } catch (error) {
      console.error("Failed to mark as read:", error);
    } finally {
      setReadingId(null);
    }
  }, [markAsRead, readingId]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-2xl min-h-screen space-y-6">
        <div className="flex items-center justify-between mb-8">
           <Skeleton className="h-8 w-8 rounded-full" />
           <Skeleton className="h-8 w-32 rounded-md" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4 p-4 border rounded-xl items-start">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="space-y-2 w-full">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <header className="sticky top-0 z-20 w-full backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="container mx-auto max-w-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-muted/50">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold tracking-tight">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center bg-primary/10 text-primary text-[11px] font-bold h-5 min-w-5 px-1.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
          </div>
          
          {notifications.length > 0 && unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllAsRead()}
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto p-4 max-w-2xl pb-10">
        <div className="space-y-3 mt-2">
          {notifications.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <BellOff className="h-9 w-9 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium text-foreground">All caught up!</h3>
              <p className="text-sm text-muted-foreground max-w-[250px] mt-1">
                You have no new notifications at the moment.
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {notifications.map((n: NotificationItem, index: number) => {
                const { icon: Icon, color, bg } = getNotificationIcon(n.topic);
                
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                    onKeyDown={(e) => {
                      if (!n.is_read && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleMarkRead(n.id);
                      }
                    }}
                    role="button"
                    tabIndex={!n.is_read ? 0 : -1}
                    className={cn(
                      "group relative flex gap-4 p-4 rounded-2xl border transition-all duration-200 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      !n.is_read 
                        ? "bg-card border-border/60 shadow-sm hover:shadow-md hover:border-primary/20 cursor-pointer" 
                        : "bg-transparent border-transparent hover:bg-muted/30 opacity-70 hover:opacity-100"
                    )}
                  >
                    {!n.is_read && (
                      <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary" />
                    )}

                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", bg)}>
                      <Icon className={cn("h-5 w-5", color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className={cn("text-sm font-semibold leading-tight", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap font-medium">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={cn("text-xs leading-relaxed line-clamp-2", !n.is_read ? "text-muted-foreground" : "text-muted-foreground/70")}>
                        {n.description}
                      </p>
                    </div>
                    
                    {!n.is_read && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {readingId === n.id ? (
                            <Loader2 className="h-3 w-3 text-primary animate-spin" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-primary/20" />
                          )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {/* INFINITE SCROLL */}
          {hasNextPage && (
            <div 
              ref={scrollTrigger}
              className="pt-6 pb-8 flex justify-center w-full"
            >
              {isFetchingNextPage ? (
                 <div className="flex items-center gap-2 text-muted-foreground text-xs animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading more notifications...
                 </div>
              ) : (
                 <div className="h-4 w-full" /> 
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}