"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useNotifications, Notification } from "@/hooks/notifications/useNotifications";
import { useUser } from "@/hooks/users/user";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCheck, BellOff, Loader2, RefreshCcw, 
  AlertTriangle, Info, CalendarClock, AlertCircle 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// --- 1. HELPER FUNCTIONS ---
const getNotificationIcon = (topic?: string) => {
  if (topic?.includes("sync")) return { icon: RefreshCcw, color: "text-green-500", bg: "bg-green-500/10" };
  if (topic?.includes("conflict")) return { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" };
  if (topic?.includes("attendance")) return { icon: CalendarClock, color: "text-blue-500", bg: "bg-blue-500/10" };
  return { icon: Info, color: "text-primary", bg: "bg-primary/10" };
};

// --- 2. NOTIFICATION CARD COMPONENT ---
const NotificationCard = ({ 
  n, 
  index, 
  onMarkRead, 
  isReading 
}: { 
  n: Notification; 
  index: number; 
  onMarkRead: (id: number) => void; 
  isReading: boolean;
}) => {
  const { icon: Icon, color, bg } = getNotificationIcon(n.topic);
  
  // Reset delay every 15 items so late items don't wait forever
  const animationDelay = (index % 15) * 0.03;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ delay: animationDelay }} 
      onClick={() => !n.is_read && onMarkRead(n.id)}
      onKeyDown={(e) => !n.is_read && (e.key === 'Enter' || e.key === ' ') && onMarkRead(n.id)}
      role="button"
      tabIndex={!n.is_read ? 0 : -1}
      className={cn(
        "group relative flex gap-4 p-4 rounded-2xl border transition-all duration-200 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary",
        !n.is_read ? "bg-card border-border/60 shadow-sm hover:shadow-md cursor-pointer" : "bg-transparent border-transparent opacity-70"
      )}
    >
      {!n.is_read && <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary" />}
      
      {/* Icon Container */}
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", bg)}>
        <Icon className={cn("h-5 w-5", color)} />
      </div>
      
      {/* Text Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2 mb-1">
          <h4 className={cn("text-sm font-semibold leading-tight break-words", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
            {n.title}
          </h4>
          <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap font-medium flex-shrink-0">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className={cn("text-xs leading-relaxed break-words", !n.is_read ? "text-muted-foreground" : "text-muted-foreground/70")}>
          {n.description}
        </p>
      </div>
      
      {!n.is_read && isReading && (
         <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="h-3 w-3 text-primary animate-spin" />
         </div>
      )}
    </motion.div>
  );
};

// --- 3. MAIN PAGE COMPONENT ---
export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const scrollTrigger = useRef<HTMLDivElement>(null);

  const { 
    actionNotifications, 
    regularNotifications, 
    unreadCount,
    isLoading, 
    markAsRead, 
    markAllAsRead,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useNotifications(true);

  const [readingId, setReadingId] = useState<number | null>(null);

  // --- INFINITE SCROLL ---
  useEffect(() => {
    if (!scrollTrigger.current || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { threshold: 0.1, rootMargin: "200px" });
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
        }).catch(console.error);
    }
  }, [user?.username, queryClient]);

  const handleMarkRead = useCallback(async (id: number) => {
    if (readingId === id) return;
    setReadingId(id);
    try { await markAsRead(id); } 
    catch (e) { console.error(e); } 
    finally { setReadingId(null); }
  }, [markAsRead, readingId]);

  if (isLoading) return <LoadingSkeleton />;

  const isEmpty = actionNotifications.length === 0 && regularNotifications.length === 0;

  return (
    <div className="min-h-screen bg-background relative">
      <header className="sticky top-0 z-20 w-full backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="container mx-auto max-w-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">Notifications 
              {unreadCount > 0 && <span className="ml-2 bg-primary/10 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
            </h1>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAllAsRead()} className="text-xs text-muted-foreground hover:text-primary">
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto p-4 max-w-2xl pb-10">
        <div className="space-y-6 mt-2">
          
          {isEmpty && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-4"><BellOff className="h-9 w-9 text-muted-foreground/50" /></div>
              <h3 className="text-lg font-medium">All caught up!</h3>
              <p className="text-sm text-muted-foreground max-w-[250px] mt-1">You have no new notifications.</p>
            </motion.div>
          )}

          {/* 1. ACTION REQUIRED SECTION */}
          <AnimatePresence mode="popLayout">
            {actionNotifications.length > 0 && (
              <motion.div 
                layout 
                key="action-section"
                className="space-y-3" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center gap-2 px-1 text-amber-500">
                  <AlertCircle className="h-4 w-4" /><h3 className="text-xs font-bold uppercase tracking-wider">Action Required</h3>
                </div>
                {actionNotifications.map((n, i) => (
                  <NotificationCard 
                    key={n.id} 
                    n={n} 
                    index={i} 
                    onMarkRead={handleMarkRead} 
                    isReading={readingId === n.id} 
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 2. REGULAR FEED SECTION */}
          {regularNotifications.length > 0 && (
            <div className="space-y-3">
                 {actionNotifications.length > 0 && (
                    <div className="flex items-center gap-2 px-1 pt-4 text-muted-foreground">
                        <h3 className="text-xs font-bold uppercase tracking-wider">Recent Activity</h3>
                    </div>
                 )}
                 
                 <AnimatePresence mode="popLayout" initial={false}>
                    {regularNotifications.map((n, i) => (
                        <NotificationCard 
                          key={n.id} 
                          n={n} 
                          index={i} 
                          onMarkRead={handleMarkRead} 
                          isReading={readingId === n.id}
                        />
                    ))}
                 </AnimatePresence>
            </div>
          )}

          {/* 3. INFINITE SCROLL TRIGGER */}
          {hasNextPage && (
            <>
               <div ref={scrollTrigger} className="h-4 w-full invisible" />
               {isFetchingNextPage && (
                 <div className="py-4 flex justify-center w-full">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs animate-pulse">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading more...
                    </div>
                 </div>
               )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}

function LoadingSkeleton() {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-2xl min-h-screen space-y-6">
        <div className="flex items-center justify-between mb-8"><Skeleton className="h-8 w-32" /></div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    );
}