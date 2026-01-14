"use client";

import { createClient } from "@/lib/supabase/client";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  unreadCount: number;
}

export function useNotifications(enabled = true) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 15;

  // 1. INFINITE FETCH QUERY
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<FetchResponse>({
    queryKey: ["notifications"],
    queryFn: async ({ pageParam = 0 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: [], nextPage: null, unreadCount: 0 };

      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Parallel Fetch: Notifications + Unread Count
      const [notificationsRes, countRes] = await Promise.all([
        supabase
          .from("notification")
          .select("*")
          .eq("auth_user_id", user.id)
          .order("created_at", { ascending: false })
          .range(from, to),
        
        // Efficient count of unread items
        supabase
          .from("notification")
          .select("*", { count: "exact", head: true })
          .eq("auth_user_id", user.id)
          .eq("is_read", false)
      ]);

      if (notificationsRes.error) throw notificationsRes.error;

      const notifications = notificationsRes.data as Notification[];
      const unreadCount = countRes.count || 0;

      // Determine if there is a next page
      const nextPage = notifications.length === PAGE_SIZE ? (pageParam as number) + 1 : null;

      return { data: notifications, nextPage, unreadCount };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: enabled,
    refetchInterval: 30000,
  });

  // Flatten pages into a single array for the UI
  const allNotifications = data?.pages.flatMap((page) => page.data) || [];
  
  // Get the latest unread count (from the most recent page fetch)
  const unreadCount = data?.pages[0]?.unreadCount || 0;

  // 2. MARK AS READ MUTATION
  const markReadMutation = useMutation({
    mutationFn: async (id?: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("notification")
        .update({ is_read: true })
        .eq("auth_user_id", user.id);

      if (id) {
        query = query.eq("id", id);
      } else {
        query = query.eq("is_read", false);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => {
      toast.error("Failed to update notification");
    },
  });

  // 3. CREATE NOTIFICATION MUTATION
  const createNotificationMutation = useMutation({
    mutationFn: async (payload: { title: string; description: string; topic?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const topic = payload.topic || "general";

      // Idempotency Check
      if (topic.startsWith("conflict-")) {
        const { data: existing } = await supabase
          .from("notification")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("topic", topic)
          .maybeSingle();

        if (existing) return; // Skip duplicate
      }

      const { error } = await supabase.from("notification").insert({
        auth_user_id: user.id,
        username: user.user_metadata?.username,
        title: payload.title,
        description: payload.description,
        topic: topic,
        is_read: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    notifications: allNotifications,
    unreadCount,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    markAsRead: (id?: number) => markReadMutation.mutate(id),
    markAllAsRead: () => markReadMutation.mutate(undefined),
    createNotification: createNotificationMutation.mutateAsync,
  };
}