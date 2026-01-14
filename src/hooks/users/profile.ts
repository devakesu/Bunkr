"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserProfile } from "@/types";
import axiosInstance from "@/lib/axios";
import { createClient } from "@/lib/supabase/client";

interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  gender?: string;
  birth_date?: string;
}

export const useProfile = () => {
  const supabase = createClient();

  return useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      // 1. Fetch Ezygo Data (Source of Truth for IDs/Credentials)
      const ezygoRes = await axiosInstance.get("/myprofile");
      const ezygoData = ezygoRes.data?.data || ezygoRes.data;

      // 2. Get Current Auth User
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 3. Fetch Existing Supabase Profile (To check for manual edits)
      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", user.id)
        .maybeSingle();

      // 4. "Soft Sync" Logic (Replicates the old Edge Function)
      // If we have a local value (edited by user), keep it. 
      // If local is empty, use Ezygo's value.
      const resolve = (local: any, remote: any) => {
        if (local && local !== "" && local !== null) return local;
        return remote || null;
      };

      // Parse Names from Ezygo if separated fields aren't present
      let remoteFirst = ezygoData.first_name;
      let remoteLast = ezygoData.last_name;
      if (!remoteFirst && ezygoData.full_name) {
        const parts = ezygoData.full_name.trim().split(" ");
        remoteFirst = parts[0];
        remoteLast = parts.slice(1).join(" ") || "";
      }

      const mergedData = {
        // IDs and Auth Links (Hard Sync - Always overwrite)
        id: ezygoData.user_id,
        auth_id: user.id,
        username: ezygoData.username || ezygoData.user?.username,
        email: ezygoData.email || ezygoData.user?.email,
        phone: ezygoData.mobile || ezygoData.user?.mobile,
        
        // Editable Profile Fields (Soft Sync - Preserve local edits)
        first_name: resolve(existingUser?.first_name, remoteFirst),
        last_name: resolve(existingUser?.last_name, remoteLast),
        gender: resolve(existingUser?.gender, ezygoData.gender || ezygoData.sex),
        birth_date: resolve(existingUser?.birth_date, ezygoData.birth_date || ezygoData.dob),
        
        // Avatar (Prefer existing, but fallback if needed)
        avatar_url: existingUser?.avatar_url || null,
        
        // System fields
        terms_version: existingUser?.terms_version,
        terms_accepted_at: existingUser?.terms_accepted_at
      };

      // 5. Upsert to Database
      const { error: upsertError } = await supabase
        .from("users")
        .upsert(mergedData, { onConflict: "id" });

      if (upsertError) {
        console.error("Profile Sync Error:", upsertError);
      }

      return mergedData as UserProfile;
    },
    staleTime: 1000 * 60 * 5,
  });
};

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ data }: { id: number; data: UpdateProfileData }) => {

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: updated, error } = await supabase
        .from("users")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          gender: data.gender,
          birth_date: data.birth_date,
        })
        .eq("auth_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}