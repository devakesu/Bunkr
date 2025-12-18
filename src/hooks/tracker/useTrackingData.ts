import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { TrackAttendance, User } from "@/types";

// CHANGED: Allow accessToken to be undefined or null
export function useTrackingData(user: User | null | undefined, accessToken: string | undefined | null) {
  return useQuery<TrackAttendance[]>({
    queryKey: ["track_data"],
    queryFn: async () => {
      // Guard clause
      if (!accessToken) return [];

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_SUPABASE_API_URL}/fetch-tracking-data`,
        {
          username: user?.username,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!res.data || !res.data.data) {
        return [];
      }
      return res.data.data;
    },
    // CHANGED: Only run query if user AND token exist
    enabled: !!user && !!accessToken,
  });
}