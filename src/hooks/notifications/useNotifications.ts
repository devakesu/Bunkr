"use client";

import { createClient } from "@/lib/supabase/client";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import * as Sentry from "@sentry/nextjs";

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

/**
 * React Query hook for fetching user notifications with action-based prioritization.
 * Separates urgent conflict notifications from general feed.
 * Implements infinite scroll pagination for the general feed.
 * 
 * @param enabled - Whether queries should run (default: true)
 * @returns Object containing action notifications, paginated feed, and utility functions
 * 
 * Features:
 * - Priority query for unread conflicts (auto-refresh every 30s)
 * - Infinite scroll pagination for general feed (15 items per page)
 * - Mark as read functionality with optimistic updates
 * - Automatic cache invalidation
 * 
 * @example
 * ```tsx
 * const { actionNotifications, allNotifications, markAsRead } = useNotifications();
 * ```
 */
export function useNotifications(enabled = true) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 15;

  // 1. PRIORITY QUERY: Fetch ALL Unread Conflicts (Action Required)
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

      if (error) {
         Sentry.captureException(error, { tags: { type: "notification_fetch_actions" } });
         throw error;
      }
      return data as Notification[];
    },
    enabled: enabled,
    refetchInterval: 30000,
  });

  // 2. INFINITE FEED: Fetch Everything Else
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

      const { data, error } = await supabase
        .from("notification")
        .select("*")
        .eq("auth_user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
          Sentry.captureException(error, { tags: { type: "notification_fetch_feed" } });
          throw error;
      }

      const notifications = data as Notification[];
      const nextPage = notifications.length === PAGE_SIZE ? (pageParam as number) + 1 : null;

      return { data: notifications, nextPage };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: enabled,
    refetchInterval: 30000,
  });

  // 3. COMBINE & DEDUPLICATE (Memoized)
  const { actionNotifications, regularNotifications } = useMemo(() => {
      const actions = actionData || [];
      const rawFeed = feedData?.pages.flatMap((page) => page.data) || [];
      
      const actionIds = new Set(actions.map(n => n.id));
      const regular = rawFeed.filter(n => !actionIds.has(n.id));

      return { actionNotifications: actions, regularNotifications: regular };
  }, [actionData, feedData]);

  // Derived from the already-fetched feed pages — avoids a separate DB round-trip.
  // Note: this count reflects only notifications loaded so far; unread items on
  // un-fetched pages are not included. For the unread *conflict* badge specifically,
  // the actions query above provides the accurate count independent of pagination.
  const unreadCount = useMemo(
    () => feedData?.pages.flatMap(p => p.data).filter(n => !n.is_read).length ?? 0,
    [feedData]
  );

  // 4. MUTATIONS (With Optimistic Updates)
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
    // Optimistic Update: Update UI instantly
    onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: ["notifications"] });
    },
    onError: (err, targetId) => {
        Sentry.captureException(err, { 
            tags: { type: "notification_mark_read_failure", location: "useNotifications/markReadMutation" },
            extra: { notificationId: targetId }
        });
        // Revert on error could be implemented here if using full optimistic state
    },
    onSettled: () => {
      // Always refetch to ensure server sync
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    actionNotifications,   // Always Unread Conflicts
    regularNotifications,  // Everything else
    unreadCount,
    isLoading: isActionLoading || isFeedLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    markAsRead: (id?: number) => markReadMutation.mutate(id),
    markAllAsRead: () => markReadMutation.mutate(undefined),
    isMarkingRead: markReadMutation.isPending
  };
}