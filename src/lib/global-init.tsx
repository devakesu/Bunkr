"use client";

import { useUserSettings } from "@/providers/user-settings";
import { useEffect } from "react";

export function GlobalInit() {
  const { settings } = useUserSettings();

  useEffect(() => {
    console.log("Global Init: Syncing settings...", settings);
  }, [settings]);

  return null;
}