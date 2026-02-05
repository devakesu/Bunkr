"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef } from "react";
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
// Minimum target defaults to 75% but can be configured via NEXT_PUBLIC_ATTENDANCE_TARGET_MIN environment variable
// to support institutions with different minimum attendance requirements.
// Values below the configured minimum are unrealistic and could cause issues in attendance calculations.
//
// DATABASE MIGRATION CONSIDERATION: If NEXT_PUBLIC_ATTENDANCE_TARGET_MIN is changed to a higher value
// (e.g., from 75 to 85), users with stored target_percentage values below the new minimum will have
// their targets silently adjusted upward on the next read. This is intentional behavior to enforce
// the institutional minimum, but consider:
// 1. Announcing the change to users before deployment
// 2. Optionally creating a database migration to update existing values proactively
// 3. Adding a database constraint: CHECK (target_percentage >= [configured_minimum])
//
// Parse the environment variable once at module load time for performance
const MIN_TARGET = (() => {
  const envValue = process.env.NEXT_PUBLIC_ATTENDANCE_TARGET_MIN;
  if (!envValue) return 75;
  const parsed = parseInt(envValue, 10);
  // Clamp to valid range, falling back to 75 if invalid
  return !isNaN(parsed) ? Math.min(100, Math.max(1, parsed)) : 75;
})();

const normalizeTarget = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 75;
  return Math.min(100, Math.max(MIN_TARGET, Math.round(value)));
};

export function useUserSettings() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  
  // Track mutation window to prevent focus refetch from overwriting optimistic updates
  // When user toggles a setting, we set this to true during onMutate
  // and clear it after onSuccess/onError to prevent stale data from overwriting changes
  const isMutatingRef = useRef(false);
  
  // Track if we've completed the initial fetch to prevent re-initialization on refetches
  // This is critical to prevent settings from resetting to defaults when query is invalidated
  const hasCompletedInitialFetchRef = useRef(false);

  // Monitor session changes to trigger settings fetch on login
  // This ensures settings are loaded immediately when user authenticates,
  // not just when navigating to protected routes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // When user signs in or session refreshes, invalidate settings cache
      // to trigger immediate re-fetch with the new auth session
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        queryClient.invalidateQueries({ queryKey: ["userSettings"] });
      }
      // When user signs out, clear settings from cache
      else if (event === "SIGNED_OUT") {
        queryClient.removeQueries({ queryKey: ["userSettings"] });
      }
    });

    return () => subscription?.unsubscribe();
  }, [queryClient, supabase.auth]);

  // 1. Fetch from DB
  const { data: settings, isLoading, isFetching } = useQuery({
    queryKey: ["userSettings"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from("user_settings")
        .select("bunk_calculator_enabled, target_percentage")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        logger.error("Error fetching settings:", error);
        Sentry.captureException(error, { tags: { type: "settings_fetch_error", location: "useUserSettings" } });
        return null;
      }

      return data as UserSettings | null;
    },
    // Populate initial data from prefetched settings or localStorage
    // This prevents flashing default values while DB is fetching
    initialData: () => {
      if (typeof window === 'undefined') return undefined;
      
      // Priority 1: Check sessionStorage for prefetched settings (fresh login)
      const prefetched = sessionStorage.getItem("prefetchedSettings");
      if (prefetched) {
        try {
          const parsed = JSON.parse(prefetched) as UserSettings;
          // NOTE: We don't remove prefetched settings here anymore to avoid race conditions
          // where component remounts cause a flash of localStorage fallback values.
          // Instead, we'll remove them after the first successful query fetch in the effect below.
          return parsed;
        } catch (error) {
          logger.error("Failed to parse prefetched settings", error);
        }
      }
      
      // Priority 2: Fall back to localStorage for existing users
      const localBunk = localStorage.getItem("showBunkCalc");
      const localTarget = localStorage.getItem("targetPercentage");
      
      if (localBunk !== null || localTarget !== null) {
        return {
          bunk_calculator_enabled: localBunk !== null ? localBunk === "true" : true,
          target_percentage: localTarget !== null ? normalizeTarget(Number(localTarget)) : 75
        } as UserSettings;
      }
      return undefined;
    },
    staleTime: 30 * 1000, // 30 seconds - reduces API load while keeping data reasonably fresh
    gcTime: 5 * 60 * 1000, // 5 minutes - keep cache for reasonable time to avoid unnecessary refetches
    refetchOnWindowFocus: () => {
      // Defensive: clear mutation flag if it's stuck (edge case safeguard)
      // This ensures refetching can resume even if onSuccess/onError somehow doesn't fire
      if (isMutatingRef.current && !updateSettingsMutation.isPending) {
        isMutatingRef.current = false;
      }
      return !isMutatingRef.current;
    },
    retry: (failureCount, error) => {
      // Retry on network errors, but not on auth errors
      // This allows initial fetch attempts while auth is pending to fail gracefully
      // and automatically retry once session is established
      // LIMITATION: Using error message string matching is not ideal as error messages can change
      // between Supabase versions or be localized. However, Supabase doesn't provide specific error
      // codes for "no user" scenarios, so string matching is the most reliable method currently available.
      // If Supabase adds error codes in the future, this should be updated to use those instead.
      const isNoUserError = error instanceof Error && error.message === "No user";
      return failureCount < 3 && !isNoUserError;
    }
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
    // Optimistic update: update cache before server responds
    onMutate: async (newSettings) => {
      // Mark that we're in a mutation window - prevents focus refetch from pulling stale data
      isMutatingRef.current = true;
      
      // Cancel any pending queries for userSettings
      await queryClient.cancelQueries({ queryKey: ["userSettings"] });
      
      // Snapshot the previous data for rollback
      const previousSettings = queryClient.getQueryData<UserSettings>(["userSettings"]);
      
      // Optimistically update the cache with normalized values
      const optimisticData = {
        ...(previousSettings || {}),
        ...newSettings,
        target_percentage: newSettings.target_percentage ? normalizeTarget(newSettings.target_percentage) : previousSettings?.target_percentage
      } as UserSettings;
      
      queryClient.setQueryData(["userSettings"], optimisticData);
      
      // Sync to localStorage immediately for instant UI feedback
      if (newSettings.bunk_calculator_enabled !== undefined) {
        localStorage.setItem("showBunkCalc", newSettings.bunk_calculator_enabled.toString());
        window.dispatchEvent(new CustomEvent("bunkCalcToggle", { detail: newSettings.bunk_calculator_enabled }));
      }
      if (newSettings.target_percentage !== undefined) {
        const normalizedTarget = normalizeTarget(newSettings.target_percentage);
        localStorage.setItem("targetPercentage", normalizedTarget.toString());
      }
      
      return { previousSettings };
    },
    onSuccess: (newData) => {
      // Update cache with actual server response (ensures normalized values)
      queryClient.setQueryData(["userSettings"], newData);
      
      // DO NOT write to localStorage here - already done in onMutate
      // This prevents redundant writes and event dispatches that cause glitches
      // Server response only validates the optimistic update was correct
      
      // Clear mutation window flag - safe to refetch on focus now
      isMutatingRef.current = false;
    },
    onError: (err, _variables, context) => {
      // Rollback to previous data on error
      if (context?.previousSettings) {
        queryClient.setQueryData(["userSettings"], context.previousSettings);
      }
      
      if (err.message !== "No user") {
        toast.error("Failed to save settings");
        Sentry.captureException(err, { tags: { type: "settings_update_error", location: "useUserSettings" } });
      }
      
      // Clear mutation window flag - safe to refetch on focus now
      isMutatingRef.current = false;
    }
  });

  const { mutate: mutateSettings } = updateSettingsMutation;

  // 3. Centralized Sync Logic
  // IMPORTANT: This effect handles two cases:
  // - Case A: DB has settings -> Sync down to localStorage (DB is source of truth)
  // - Case B: DB query completed and is empty (new user) -> Create DB record from localStorage or defaults
  useEffect(() => {
    // Skip on server-side render
    if (typeof window === 'undefined') return;
    
    // Skip while mutation is pending, or while query is loading/fetching
    // We need complete data from DB before deciding whether to initialize
    if (updateSettingsMutation.isPending || isLoading || isFetching) return;

    // Case A: DB has data -> Sync to LocalStorage ONLY if different (Source of Truth = DB)
    // This handles cross-device sync (e.g., changed settings on another device)
    if (settings) {
      // Mark that we've completed a successful fetch
      hasCompletedInitialFetchRef.current = true;
      
      // Clean up prefetched settings after first successful DB fetch
      // This prevents stale prefetched data from being reused on subsequent initialData calls
      if (sessionStorage.getItem("prefetchedSettings") !== null) {
        sessionStorage.removeItem("prefetchedSettings");
      }
      
      const localBunk = localStorage.getItem("showBunkCalc");
      const dbBunk = (settings.bunk_calculator_enabled ?? true).toString();
      
      // Only sync if localStorage differs from DB (cross-device change)
      if (localBunk !== dbBunk) {
        localStorage.setItem("showBunkCalc", dbBunk);
        window.dispatchEvent(new CustomEvent("bunkCalcToggle", { detail: settings.bunk_calculator_enabled ?? true }));
      }
      
      const localTarget = localStorage.getItem("targetPercentage");
      const dbTarget = normalizeTarget(settings.target_percentage).toString();
      
      // Only sync if localStorage differs from DB
      if (localTarget !== dbTarget) {
        localStorage.setItem("targetPercentage", dbTarget);
      }
    } 
    // Case B: DB is empty (New User) -> Migrate LocalStorage to DB or Initialize with defaults
    // CRITICAL: Only run initialization on first fetch to prevent resetting on subsequent refetches
    else if (settings === null && !hasCompletedInitialFetchRef.current) {
      const localBunk = localStorage.getItem("showBunkCalc");
      const localTarget = localStorage.getItem("targetPercentage");
      
      // Check if we have prefetched settings that should be synced to DB
      // This happens when user just logged in and settings were fetched from /api/auth/save-token
      const hasPrefetchedSettings = sessionStorage.getItem("prefetchedSettings") !== null;
      
      // Skip initialization if prefetched settings exist - they'll be synced on next query success
      // The prefetched settings are already in the query cache from initialData, so the next
      // successful DB response will trigger Case A above to sync them
      if (hasPrefetchedSettings) {
        // Don't mark as completed yet - wait for actual DB sync in Case A
        return;
      }
      
      hasCompletedInitialFetchRef.current = true;

      // Create DB record using localStorage values if they exist, otherwise use defaults
      mutateSettings({
        bunk_calculator_enabled: localBunk !== null ? localBunk === "true" : true,
        target_percentage: localTarget !== null ? normalizeTarget(Number(localTarget)) : 75
      });
    }
    // mutateSettings is stable - it's the mutate function from useMutation and doesn't change between renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, isLoading, isFetching, updateSettingsMutation.isPending]);

  return {
    settings,
    isLoading: isLoading || isFetching,
    updateBunkCalc: (enabled: boolean) => mutateSettings({ bunk_calculator_enabled: enabled }),
    updateTarget: (target: number) => mutateSettings({ target_percentage: normalizeTarget(target) })
  };
}