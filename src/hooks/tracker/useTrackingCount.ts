import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { User } from "@/types";
import { useFetchAcademicYear, useFetchSemester } from "../users/settings";
  
export function useTrackingCount(user: User | null | undefined) {
  const supabase = createClient();
  const { data: semesterData} = useFetchSemester();
  const { data: academicYearData} = useFetchAcademicYear();

  return useQuery<number>({
    queryKey: ["count", user?.username],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return 0;

      const { count, error } = await supabase
        .from("tracker")
        .select("*", { count: "exact", head: true })
        .eq("semester", semesterData)
        .eq("year", academicYearData);

      if (error) {
        console.error("Error fetching count:", error);
        return 0;
      }

      return count ?? 0;
    },
    enabled: !!user,
  });
}