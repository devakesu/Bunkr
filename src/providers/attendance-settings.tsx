"use client";

import {
  createContext,
  useContext,
  ReactNode,
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
  const targetPercentage = settings?.target_percentage ?? 75;

  return (
    <AttendanceSettingsContext.Provider
      value={{
        targetPercentage,
        setTargetPercentage: updateTarget,
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