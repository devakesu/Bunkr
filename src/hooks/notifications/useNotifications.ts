"use client";

import { createClient } from "@/lib/supabase/client";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
export interface Notification {
  id: number;
  title: string;
  description?: string;
  topic: string;
  is_read: boolean;
  created_at: string;
  auth_user_id: string;
}

interface FetchResponse {
  data: Notification[];
  nextPage: number | null;
}

export function useNotifications(enabled = true) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 15;

  // 1. PRIORITY QUERY: Fetch ALL Unread Conflicts (Action Required)
  // This ensures they are ALWAYS at the top, regardless of date.
  const { data: actionData, isLoading: isActionLoading } = useQuery({
    queryKey: ["notifications", "actions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("notification")
        .select("*")
        .eq("auth_user_id", user.id)
        .ilike("topic", "conflict%") // Only conflicts
        .eq("is_read", false)        // Only unread
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Notification[];
    },
    enabled: enabled,
    refetchInterval: 30000,
  });

  // DEDICATED QUERY: Total Unread Count
  // This provides an accurate count of all unread notifications,
  // regardless of how many pages have been loaded.
  const { data: unreadCountData, isLoading: isUnreadCountLoading } = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from("notification")
        .select("*", { count: "exact", head: true })
        .eq("auth_user_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.error(`Error fetching unread count for user ${user.id}:`, error);
        return 0;
      }

      return count ?? 0;
    },
    enabled: enabled,
    refetchInterval: 30000,
  });

  // 2. INFINITE FEED: Fetch Everything Else
  // (Regular items + Read Conflicts)
  const {
    data: feedData,
    isLoading: isFeedLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<FetchResponse>({
    queryKey: ["notifications", "feed"],
    queryFn: async ({ pageParam = 0 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: [], nextPage: null };

      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Fetch notifications that are NOT (conflict AND unread)
      // Strategy: Fetch ALL by date, deduplicate in UI.
      const { data, error } = await supabase
        .from("notification")
        .select("*")
        .eq("auth_user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const notifications = data as Notification[];
      const nextPage = notifications.length === PAGE_SIZE ? (pageParam as number) + 1 : null;

      return { data: notifications, nextPage };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: enabled,
    refetchInterval: 30000,
  });

  // 3. COMBINE & DEDUPLICATE
  // We have "Action Items" and "Feed Items". 
  // We need to remove Action Items from the Feed to avoid showing them twice.
  const actionNotifications = actionData || [];
  
  // Flatten feed pages
  const rawFeed = feedData?.pages.flatMap((page) => page.data) || [];
  
  // Filter out items that are already in the "Action" list
  const actionIds = new Set(actionNotifications.map(n => n.id));
  const regularNotifications = rawFeed.filter(n => !actionIds.has(n.id));

  // Use the dedicated unread count query for accuracy
  const unreadCount = unreadCountData ?? 0;

  // 4. MUTATIONS
  const markReadMutation = useMutation({
    mutationFn: async (id?: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("notification")
        .update({ is_read: true })
        .eq("auth_user_id", user.id);

      if (id) query = query.eq("id", id);
      else query = query.eq("is_read", false);

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate both lists so items move from "Action" -> "Feed"
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    actionNotifications,   // Always Unread Conflicts
    regularNotifications,  // Everything else
    unreadCount,
    isLoading: isActionLoading || isFeedLoading || isUnreadCountLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    markAsRead: (id?: number) => markReadMutation.mutate(id),
    markAllAsRead: () => markReadMutation.mutate(undefined),
  };
}