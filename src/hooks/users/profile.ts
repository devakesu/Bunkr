"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserProfile } from "@/types";
import axiosInstance from "@/lib/axios";
import { createClient } from "@/lib/supabase/client";
import * as Sentry from "@sentry/nextjs";

interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  gender?: string;
  birth_date?: string;
}

export const useProfile = () => {
  const supabase = createClient();

  return useQuery<UserProfile | null>({
    queryKey: ["profile"],
    queryFn: async () => {
      // 1. Get Current Auth User (Required)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 2. Fetch Existing Supabase Profile (Local Source)
      const { data: existingUser, error: dbError } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (dbError) {
         Sentry.captureException(dbError, { tags: { type: "profile_local_fetch_error", location: "useProfile/queryFn" } });
      }

      // 3. Fetch Ezygo Data (Remote Source)
      let ezygoData: any = null;
      try {
        const ezygoRes = await axiosInstance.get("/myprofile");
        ezygoData = ezygoRes.data?.data || ezygoRes.data;
      } catch (err) {
        console.warn("Ezygo profile fetch failed, using local fallback.");
        // Non-fatal error: Log to Sentry as warning but continue
        Sentry.captureException(err, { tags: { type: "ezygo_profile_sync_fail", location: "useProfile/queryFn" } });
      }

      // 4. FALLBACK LOGIC: If Ezygo is down, fail instead of returning potentially stale local data
      if (!ezygoData) {
        Sentry.captureMessage("Failed to load fresh profile data from Ezygo; aborting to avoid serving stale data.", {
          level: "error",
          tags: { type: "profile_remote_unavailable", location: "useProfile/queryFn" },
        });
        throw new Error("Failed to load profile data from remote source.");
      }

      // 5. "Soft Sync" Logic
      const resolve = (local: any, remote: any) => {
        if (local && local !== "" && local !== null) return local;
        return remote || null;
      };

      // Parse Names
      let remoteFirst = ezygoData.first_name;
      let remoteLast = ezygoData.last_name;
      if (!remoteFirst && ezygoData.full_name) {
        const parts = ezygoData.full_name.trim().split(" ");
        remoteFirst = parts[0];
        remoteLast = parts.slice(1).join(" ") || "";
      }

      const mergedData = {
        // IDs and Auth Links (Hard Sync - Always overwrite)
        id: ezygoData.user_id, // This links the tables
        auth_id: user.id,
        username: ezygoData.username || ezygoData.user?.username,
        email: ezygoData.email || ezygoData.user?.email,
        phone: ezygoData.mobile || ezygoData.user?.mobile,
        
        // Editable Profile Fields (Soft Sync - Preserve local edits)
        first_name: resolve(existingUser?.first_name, remoteFirst),
        last_name: resolve(existingUser?.last_name, remoteLast),
        gender: resolve(existingUser?.gender, ezygoData.gender || ezygoData.sex),
        birth_date: resolve(existingUser?.birth_date, ezygoData.birth_date || ezygoData.dob),
        
        // Avatar
        avatar_url: existingUser?.avatar_url || null,
        
        // System fields
        terms_version: existingUser?.terms_version,
        terms_accepted_at: existingUser?.terms_accepted_at
      };

      // 6. Upsert to Database (Sync)
      const { error: upsertError } = await supabase
        .from("users")
        .upsert(mergedData, { onConflict: "id" });

      if (upsertError) {
        console.error("Profile Sync Error:", upsertError);
        Sentry.captureException(upsertError, { 
            tags: { type: "profile_upsert_fail", location: "useProfile/queryFn" },
            extra: { userId: user.id }
        });
      }

      return mergedData as UserProfile;
    },
    // Cache for 5 mins to avoid spamming the sync logic
    staleTime: 1000 * 60 * 5,
    retry: 1, // Only retry once if Ezygo fails
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
    // Optimistic Update: Update UI instantly
    // 1. SNAPSHOT & OPTIMISTIC UPDATE
    onMutate: async ({ data }) => {
        // Stop any background refetches so they don't overwrite our optimistic update
        await queryClient.cancelQueries({ queryKey: ["profile"] });
        
        // SNAPSHOT: Get the current valid data before we mess with it
        const previousProfile = queryClient.getQueryData<UserProfile>(["profile"]);

        // UPDATE: Manually write the new data to the cache immediately
        if (previousProfile) {
            queryClient.setQueryData<UserProfile>(["profile"], {
                ...previousProfile, // Keep existing fields (id, email, etc.)
                ...data,            // Overwrite with new edits (first_name, etc.)
            });
        }

        // Return the snapshot so 'onError' can access it
        return { previousProfile };
    },

    // 2. ROLLBACK ON FAILURE
    onError: (err, variables, context) => {
      // Check if we have a saved snapshot
      if (context?.previousProfile) {
          // REVERT: Force the cache back to the old data
          queryClient.setQueryData(["profile"], context.previousProfile);
      }
      // Report the crash
      Sentry.captureException(err, { tags: { type: "profile_update_mutation_error", location: "useUpdateProfile/onError" } });
    },

    // 3. FINAL VERIFICATION
    onSettled: () => {
      // Always refetch from server at the end to ensure 100% consistency
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}