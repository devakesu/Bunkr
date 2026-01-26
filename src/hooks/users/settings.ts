// Manage user settings such as default semester and academic year
// src/hooks/users/settings.ts

import axios from "@/lib/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/nextjs";

type SemesterData = {
  default_semester: "even" | "odd";
};

type AcademicYearData = {
  default_academic_year: string;
};

export const useFetchSemester = () => {
  return useQuery<"even" | "odd" | null>({
    queryKey: ["semester"],
    queryFn: async () => {
      try {
        const res = await axios.get("/user/setting/default_semester");
        return res.data;
      } catch (error: any) {
        if (error.response?.status === 404) return null;
        throw error;
      }
    },
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors (401/403) - these need user intervention
      if (error.response?.status === 401 || error.response?.status === 403) return false;
      // Use default retry logic for other errors (up to 2 retries from react-query config)
      return failureCount < 2;
    },
    staleTime: 1000 * 60 * 5, 
    refetchOnWindowFocus: true, 
  });
};

export const useFetchAcademicYear = () => {
  return useQuery<string | null>({
    queryKey: ["academic-year"],
    queryFn: async () => {
      try {
        const res = await axios.get("/user/setting/default_academic_year");
        return res.data;
      } catch (error: any) {
        if (error.response?.status === 404) return null;
        throw error;
      }
    },
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors (401/403) - these need user intervention
      if (error.response?.status === 401 || error.response?.status === 403) return false;
      // Use default retry logic for other errors (up to 2 retries from react-query config)
      return failureCount < 2;
    },
    staleTime: 1000 * 60 * 5, 
    refetchOnWindowFocus: true,
  });
};

export const useSetSemester = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (semesterData: SemesterData) => {
      const res = await axios.post(
        "/user/setting/default_semester",
        semesterData
      );
      return res.data;
    },
    onSuccess: (_data, variables) => {
      // 1. Update the Setting Cache immediately
      queryClient.setQueryData(["semester"], variables.default_semester);

      // 2. Refresh ALL Dependent Data
      // This ensures courses, attendance, and manual tracking data all switch to the new semester
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["track_data"] }); // Refetch tracking data
      queryClient.invalidateQueries({ queryKey: ["count"] });      // Refetch stats
    },
    onError: (error) => {
      console.error("Error setting semester:", error);
      Sentry.captureException(error, { tags: { type: "setting_update_error", location: "useSetSemester/onError" } });
    },
  });
};

export const useSetAcademicYear = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (academicYearData: AcademicYearData) => {
      const res = await axios.post(
        "/user/setting/default_academic_year",
        academicYearData
      );
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData(
        ["academic-year"],
        variables.default_academic_year
      );

      // Refresh ALL Dependent Data
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["track_data"] });
      queryClient.invalidateQueries({ queryKey: ["count"] });
    },
    onError: (error) => {
      console.error("Error setting academic year:", error);
      Sentry.captureException(error, { tags: { type: "setting_update_error", location: "useSetAcademicYear/onError" } });
    },
  });
};