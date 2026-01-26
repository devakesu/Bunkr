"use client";

import { useUserSettings } from "@/providers/user-settings";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export function GlobalInit() {
  const { settings } = useUserSettings();

  useEffect(() => {
    Sentry.setContext(
      "user_preferences",
      settings ? { ...settings } : null
    );

    if (process.env.NODE_ENV === "development") {
      console.log("Global Init: Syncing settings...", settings);
    }
  }, [settings]);

  return null;
}