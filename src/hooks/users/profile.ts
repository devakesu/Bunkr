import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserProfile } from "@/types";
import { getToken } from "@/utils/auth";
import axiosInstance from "@/lib/axios";

interface UpdateProfileData {
  id: number;
  data: UserProfile;
}

export const useProfile = () => {
  return useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      // 1. Fetch Rich Data from Ezygo
      const ezygoRes = await axiosInstance.get("/myprofile");
      const ezygoData = ezygoRes.data;

      // 2. Sync with Supabase & Get Avatar
      const token = getToken();
      const supabaseRes = await axios.post(
        `${process.env.NEXT_PUBLIC_SUPABASE_API_URL}/fetch-user-data`,
        ezygoData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // 3. Return the merged result
      return supabaseRes.data;
    },
    staleTime: 1000 * 60 * 5, 
  });
};

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateProfileData) => {
      const token = getToken();
      
      // CHANGE: Call the Supabase Edge Function 'update-user-profile'
      // This ensures the edits are saved to your Supabase database
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_SUPABASE_API_URL}/update-user-data`,
        {
          id,
          first_name: data.first_name,
          last_name: data.last_name,
          gender: data.gender,
          birth_date: data.birth_date,
          // We only send the fields we want to update in Supabase
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.data) throw new Error("Failed to update profile");
      return res.data;
    },
    onSuccess: () => {
      // Refresh the profile data to show the new changes immediately
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}