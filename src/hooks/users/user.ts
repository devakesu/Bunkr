// Fetch user data using React Query
// src/hooks/users/user.ts

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/lib/axios";
import { User } from "@/types";
import { handleLogout } from "@/lib/auth";

export const useUser = () => {
  return useQuery<User>({
    queryKey: ["user"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user");
      if (!res) {
        handleLogout();
      }
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};
