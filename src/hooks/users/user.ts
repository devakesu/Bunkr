// Fetch user data using React Query
// src/hooks/users/user.ts

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/lib/axios";
import { User } from "@/types";

export const useUser = () => {
  return useQuery<User>({
    queryKey: ["user"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user");
      if (!res) throw new Error("Failed to fetch user data");
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};
