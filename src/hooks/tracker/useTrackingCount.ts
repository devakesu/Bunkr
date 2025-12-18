import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { User } from "@/types";

// CHANGED: Allow accessToken to be undefined or null
export function useTrackingCount(user: User | null | undefined, accessToken: string | undefined | null) {
  return useQuery<number>({
    queryKey: ["count", user?.username],
    queryFn: async () => {
      // Guard clause (though 'enabled' handles this, it satisfies TS inside the fn)
      if (!accessToken) return 0;

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_SUPABASE_API_URL}/fetch-count`,
        { username: user?.username },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      return res.data?.count ?? 0;
    },
    // CHANGED: Only run query if user AND token exist
    enabled: !!user && !!accessToken,
  });
}