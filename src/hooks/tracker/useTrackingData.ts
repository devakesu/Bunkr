import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { TrackAttendance, User } from "@/types";
import { useFetchAcademicYear, useFetchSemester } from "../users/settings";
import * as Sentry from "@sentry/nextjs";

export function useTrackingData(user: User | null | undefined, options?: { enabled?: boolean }) {
  const supabase = createClient();
  
  const { data: semesterData } = useFetchSemester();
  const { data: academicYearData } = useFetchAcademicYear();

  return useQuery<TrackAttendance[]>({
    queryKey: [
      "track_data",
      user?.username,
      JSON.stringify(semesterData),
      JSON.stringify(academicYearData),
    ],
    
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return [];

      // Explicit null checks to prevent race conditions
      if (!semesterData || !academicYearData) {
        return [];
      }

      const { data, error } = await supabase
        .from("tracker")
        .select("*")
        .eq("semester", semesterData) 
        .eq("year", academicYearData)
        .order("date", { ascending: false }) 
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching tracking data:", error);
        
        Sentry.captureException(error, {
            tags: { type: "tracking_fetch_error" },
            extra: { 
                username: user?.username,
                semester: semesterData,
                year: academicYearData
            }
        });
        
        return [];
      }

      return (data as TrackAttendance[]) || [];
    },
    enabled: !!user && (options?.enabled !== false),
    staleTime: 1000 * 60,
  });
}