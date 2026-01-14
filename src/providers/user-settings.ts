"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";
import { UserSettings } from "@/types/user-settings";

export function useUserSettings() {
  const supabase = createClient();
  const queryClient = useQueryClient();

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

      if (data) {
        // Sync Logic: DB -> LocalStorage
        const localBunk = localStorage.getItem("showBunkCalc");
        const dbBunk = data.bunk_calculator_enabled.toString();
        
        if (localBunk !== dbBunk) {
           localStorage.setItem("showBunkCalc", dbBunk);
           window.dispatchEvent(new CustomEvent("bunkCalcToggle", { detail: data.bunk_calculator_enabled }));
        }
        localStorage.setItem("targetPercentage", data.target_percentage.toString());
      }
      
      return data as UserSettings | null;
    },
    initialData: () => {
      if (typeof window === "undefined") return undefined;
      const localBunk = localStorage.getItem("showBunkCalc");
      const localTarget = localStorage.getItem("targetPercentage");
      
      if (localBunk === null && localTarget === null) return undefined;

      return {
        bunk_calculator_enabled: localBunk !== null ? localBunk === "true" : true,
        target_percentage: localTarget ? Number(localTarget) : 75
      };
    },
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
      }
    },
    onError: (err) => {
      if (err.message !== "No user") {
        toast.error("Failed to save settings");
      }
    }
  });

  // 3. Synchronization Logic (Migrate LocalStorage to DB if DB is empty)
  useEffect(() => {
    if (!isLoading && settings === null) {
      
      const syncIfLoggedIn = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // User is logged in but has no settings -> Sync LocalStorage to DB
          const localBunkCalc = localStorage.getItem("showBunkCalc");
          const initialBunk = localBunkCalc !== null ? localBunkCalc === "true" : true; 
          const initialTarget = 75; 

          updateSettings.mutate({
            bunk_calculator_enabled: initialBunk,
            target_percentage: initialTarget
          });
        }
      };

      syncIfLoggedIn();
    }
  }, [isLoading, settings]);

  return {
    settings,
    isLoading,
    updateBunkCalc: (enabled: boolean) => updateSettings.mutate({ bunk_calculator_enabled: enabled }),
    updateTarget: (target: number) => updateSettings.mutate({ target_percentage: target })
  };
}