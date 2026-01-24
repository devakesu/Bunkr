"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";
import { UserSettings } from "@/types/user-settings";

export function useUserSettings() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 1. Fetch from DB
  const { data: settings, isLoading } = useQuery({
    queryKey: ["userSettings"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from("user_settings")
        .select("bunk_calculator_enabled, target_percentage")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching settings:", error);
      }

      return data as UserSettings | null;
    },
    // Ensure fresh fetch on mount to detect "New User" state immediately
    staleTime: 0, 
    refetchOnWindowFocus: false,
  });

  // 2. Mutation to update settings
  const updateSettings = useMutation({
    mutationFn: async (newSettings: { bunk_calculator_enabled?: boolean; target_percentage?: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("No user");

      const { data, error } = await supabase
        .from("user_settings")
        .upsert({ user_id: session.user.id, ...newSettings })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(["userSettings"], newData);
      
      if (newData.bunk_calculator_enabled !== undefined) {
         localStorage.setItem("showBunkCalc", newData.bunk_calculator_enabled.toString());
         window.dispatchEvent(new CustomEvent("bunkCalcToggle", { detail: newData.bunk_calculator_enabled }));
      }
      if (newData.target_percentage) {
         localStorage.setItem("targetPercentage", newData.target_percentage.toString());
      }
    },
    onError: (err) => {
      if (err.message !== "No user") toast.error("Failed to save settings");
    }
  });

  // 3. Centralized Sync Logic
  useEffect(() => {
    if (isLoading) return;

    // Case A: DB has data -> Sync to LocalStorage
    if (settings) {
      const localBunk = localStorage.getItem("showBunkCalc");
      // Handle potential nulls in DB
      const dbBunk = (settings.bunk_calculator_enabled ?? true).toString();
      
      if (localBunk !== dbBunk) {
        localStorage.setItem("showBunkCalc", dbBunk);
        window.dispatchEvent(new CustomEvent("bunkCalcToggle", { detail: settings.bunk_calculator_enabled ?? true }));
      }
      
      const localTarget = localStorage.getItem("targetPercentage");
      const dbTarget = (settings.target_percentage ?? 75).toString();
      
      if (localTarget !== dbTarget) {
        localStorage.setItem("targetPercentage", dbTarget);
      }
    } 
    // Case B: DB is empty (New User) -> Try to migrate LocalStorage to DB
    else if (settings === null) {
      const localBunk = localStorage.getItem("showBunkCalc");
      const localTarget = localStorage.getItem("targetPercentage");

      // Only migrate if we actually have local data
      if (localBunk !== null || localTarget !== null) {
        updateSettings.mutate({
          bunk_calculator_enabled: localBunk === "true",
          target_percentage: localTarget ? Number(localTarget) : 75
        });
      }
    }
  }, [settings, isLoading]);

  return {
    settings,
    isLoading,
    updateBunkCalc: (enabled: boolean) => updateSettings.mutate({ bunk_calculator_enabled: enabled }),
    updateTarget: (target: number) => updateSettings.mutate({ target_percentage: target })
  };
}