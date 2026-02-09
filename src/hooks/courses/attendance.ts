// Fetch attendance report and course details hooks
// src/hooks/courses/attendance.ts

import axios from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import { AttendanceReport, CourseDetail } from "@/types";

export const useAttendanceReport = (options?: { enabled?: boolean; initialData?: AttendanceReport | null }) => {
  return useQuery<AttendanceReport | null>({
    queryKey: ["attendance-report"],
    queryFn: async () => {
      const res = await axios.post("/attendancereports/student/detailed");
      if (!res) throw new Error("Failed to fetch attendance report data");
      return res.data;
    },
    enabled: options?.enabled,
    initialData: options?.initialData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60 * 1000,
    retry: 1,
  });
};

export const useCourseDetails = (courseId: string) => {
  return useQuery<CourseDetail>({
    queryKey: ["attendance-report", courseId],
    queryFn: async () => {
      if (!courseId) throw new Error("Course ID is required");

      const res = await axios.get(
        `/attendancereports/institutionuser/courses/${courseId}/summery`
      );
      if (!res) throw new Error("Failed to fetch course details data");
      return res.data;
    },
    enabled: !!courseId,
    staleTime: 2 * 60 * 1000, // 2 minutes - balance between real-time and performance
    gcTime: 10 * 60 * 1000,
    refetchOnReconnect: true, // Keep real-time on reconnect
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes instead of 1 minute
    retry: 2,
  });
};
