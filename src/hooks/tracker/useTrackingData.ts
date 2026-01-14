import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { TrackAttendance, User } from "@/types";

export function useTrackingData(user: User | null | undefined, options?: { enabled?: boolean }) {
  const supabase = createClient();

  return useQuery<TrackAttendance[]>({
    queryKey: ["track_data", user?.username],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return [];

      const { data, error } = await supabase
        .from("tracker")
        .select("*")
        .order("id", { ascending: false });

      if (error) {
        console.error("Error fetching tracking data:", error);
        return [];
      }

      return (data as TrackAttendance[]) || [];
    },
    enabled: !!user && (options?.enabled !== false)
  });
}