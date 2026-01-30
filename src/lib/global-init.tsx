"use client";

import { useUserSettings } from "@/providers/user-settings";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

export function GlobalInit() {
  const { settings } = useUserSettings();

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      Sentry.setContext(
        "user_preferences",
        settings ? { ...settings } : null
      );
      logger.dev("Global Init: Syncing settings...", settings);
    }
  }, [settings]);

  return null;
}