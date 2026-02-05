"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useMemo,
} from "react";
import { useUserSettings } from "@/providers/user-settings";

interface AttendanceSettingsContextType {
  targetPercentage: number;
  setTargetPercentage: (percentage: number) => void;
  isLoading: boolean;
}

const AttendanceSettingsContext = createContext<
  AttendanceSettingsContextType | undefined
>(undefined);

interface AttendanceSettingsProviderProps {
  children: ReactNode;
}

export function AttendanceSettingsProvider({
  children,
}: AttendanceSettingsProviderProps) {
  const { settings, updateTarget, isLoading } = useUserSettings();
  
  const targetPercentage = useMemo(() => {
    if (settings?.target_percentage !== undefined) {
      return settings.target_percentage;
    }
    if (typeof window === "undefined") return 75;
    try {
      const stored = localStorage.getItem("targetPercentage");
      return stored ? parseInt(stored, 10) : 75;
    } catch {
      // localStorage can fail in private browsing mode or when storage is disabled
      return 75;
    }
  }, [settings?.target_percentage]);

  const setTargetPercentage = (percentage: number) => {
    updateTarget(percentage);
  };

  return (
    <AttendanceSettingsContext.Provider
      value={{
        targetPercentage,
        setTargetPercentage,
        isLoading
      }}
    >
      {children}
    </AttendanceSettingsContext.Provider>
  );
}

export const useAttendanceSettings = () => {
  const context = useContext(AttendanceSettingsContext);
  if (context === undefined) {
    throw new Error(
      "useAttendanceSettings must be used within an AttendanceSettingsProvider"
    );
  }
  return context;
};