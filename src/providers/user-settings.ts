"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";
import { UserSettings } from "@/types/user-settings";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

// normalizeTarget is defined at module-level (outside the hook) to avoid recreation on every render.
// This is preferred over useCallback because:
// 1. The function has no dependencies (pure function with no closure over component state/props)
// 2. Module-level avoids the overhead of useCallback's dependency checking
// 3. Provides a stable reference without requiring React hooks infrastructure
// If this function needed access to component state/props, useCallback would be more appropriate.
//
// Minimum target defaults to 50% but can be configured via ATTENDANCE_TARGET_MIN environment variable
// to support institutions with different minimum attendance requirements.
// Values below the configured minimum are unrealistic and could cause issues in attendance calculations.
//
// Parse the environment variable once at module load time for performance
const MIN_TARGET = (() => {
  const envValue = process.env.ATTENDANCE_TARGET_MIN;
  if (!envValue) return 50;
  const parsed = parseInt(envValue, 10);
  // Clamp to valid range, falling back to 50 if invalid
  return !isNaN(parsed) ? Math.min(100, Math.max(1, parsed)) : 50;
})();

const normalizeTarget = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 75;
  return Math.min(100, Math.max(MIN_TARGET, Math.round(value)));
};

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
    staleTime: 30 * 1000, // 30 seconds - reduces API load while keeping data reasonably fresh
    gcTime: 0,
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
        if (newData.target_percentage !== undefined) {
          localStorage.setItem("targetPercentage", normalizeTarget(newData.target_percentage).toString());
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
      const dbTarget = normalizeTarget(settings.target_percentage).toString();
      
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
        logger.dev("Migrating local settings to cloud...");
        mutateSettings({
          bunk_calculator_enabled: localBunk !== null ? localBunk === "true" : true,
          target_percentage: localTarget !== null ? normalizeTarget(Number(localTarget)) : 75
        });
      }
    }
    // mutateSettings is stable - it's the mutate function from useMutation and doesn't change between renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, isLoading]);

  return {
    settings,
    isLoading,
    updateBunkCalc: (enabled: boolean) => mutateSettings({ bunk_calculator_enabled: enabled }),
    updateTarget: (target: number) => mutateSettings({ target_percentage: normalizeTarget(target) })
  };
}