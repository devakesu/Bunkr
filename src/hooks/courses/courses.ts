// Fetch courses hook
// src/hooks/courses/courses.ts

import axios from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import { Course } from "@/types";

export const useFetchCourses = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const res = await axios.get("/institutionuser/courses/withusers");
      if (!res) throw new Error("Failed to fetch courses data");

      const courses = res.data || [];

      const formattedData = {
        courses: courses.reduce(
          (acc: Record<string, Course>, course: Course) => {
            acc[course.id.toString()] = course;
            return acc;
          },
          {}
        ),
      };

      return formattedData;
    },
    enabled: options?.enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60 * 1000,
    retry: 1,
    retryDelay: 1000,
  });
};
