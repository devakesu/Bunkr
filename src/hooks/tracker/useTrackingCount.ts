import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { User } from "@/types";
import { useFetchAcademicYear, useFetchSemester } from "../users/settings";
import * as Sentry from "@sentry/nextjs";

export function useTrackingCount(user: User | null | undefined) {
  const supabase = createClient();
  const { data: semesterData } = useFetchSemester();
  const { data: academicYearData } = useFetchAcademicYear();

  return useQuery<number>({
    queryKey: ["count", user?.username, semesterData, academicYearData],
    
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return 0;

      // Explicit null checks to prevent race conditions
      if (!semesterData || !academicYearData) {
        return 0;
      }

      const { count, error } = await supabase
        .from("tracker")
        .select("*", { count: "exact", head: true })
        .eq("semester", semesterData)
        .eq("year", academicYearData);

      if (error) {
        console.error("Error fetching count:", error);
        
        Sentry.captureException(error, { 
            tags: { type: "tracking_count_fetch_error", location: "useTrackingCount/queryFn" },
            extra: { 
                username: user?.username,
                semester: semesterData, 
                year: academicYearData 
            }
        });
        
        return 0;
      }

      return count ?? 0;
    },
    enabled: !!user?.username,
    staleTime: 1000 * 60, 
  });
}