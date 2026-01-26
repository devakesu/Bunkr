"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";
import { UserSettings } from "@/types/user-settings";
import * as Sentry from "@sentry/nextjs";

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
        .maybeSingle(); // Returns null if row missing (cleaner than .single() + error catching)

      if (error) {
        console.error("Error fetching settings:", error);
        Sentry.captureException(error, { tags: { type: "settings_fetch_error", location: "useUserSettings" } });
        return null;
      }

      return data as UserSettings | null;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true, 
  });
  
  // 2. Mutation to update settings
  const updateSettingsMutation = useMutation({
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
      // Instant UI update via Cache
      queryClient.setQueryData(["userSettings"], newData);
      
      // Sync to Local Storage & Events immediately
      if (newData.bunk_calculator_enabled !== undefined) {
          localStorage.setItem("showBunkCalc", newData.bunk_calculator_enabled.toString());
          window.dispatchEvent(new CustomEvent("bunkCalcToggle", { detail: newData.bunk_calculator_enabled }));
      }
      if (newData.target_percentage) {
          localStorage.setItem("targetPercentage", newData.target_percentage.toString());
      }
    },
    onError: (err) => {
      if (err.message !== "No user") {
          toast.error("Failed to save settings");
          Sentry.captureException(err, { tags: { type: "settings_update_error", location: "useUserSettings" } });
      }
    }
  });

  const { mutate: mutateSettings } = updateSettingsMutation;

  // 3. Centralized Sync Logic
  useEffect(() => {
    if (isLoading) return;

    // Case A: DB has data -> Sync to LocalStorage (Source of Truth = DB)
    if (settings) {
      const localBunk = localStorage.getItem("showBunkCalc");
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
    // Case B: DB is empty (New User) -> Migrate LocalStorage to DB
    else if (settings === null) {
      const localBunk = localStorage.getItem("showBunkCalc");
      const localTarget = localStorage.getItem("targetPercentage");

      // Only migrate if we actually have legacy local data
      if (localBunk !== null || localTarget !== null) {
        console.log("Migrating local settings to cloud...");
        mutateSettings({
          bunk_calculator_enabled: localBunk !== null ? localBunk === "true" : true,
          target_percentage: localTarget !== null ? Number(localTarget) : 75
        });
      }
    }
  }, [settings, isLoading, mutateSettings]);

  return {
    settings,
    isLoading,
    updateBunkCalc: (enabled: boolean) => mutateSettings({ bunk_calculator_enabled: enabled }),
    updateTarget: (target: number) => mutateSettings({ target_percentage: target })
  };
}