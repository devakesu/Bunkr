import { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
import DashboardClient from "./DashboardClient";
import { fetchDashboardData } from "@/lib/ezygo-batch-fetcher";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { Loading } from "@/components/loading";

// Force dynamic rendering for protected routes
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Dashboard",
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * Separate async component so the page shell (navbar, layout) can be sent to the
 * browser immediately after the fast auth check, while this component streams in
 * once fetchDashboardData resolves. This converts a blocking ~770 ms TTFB into
 * perceived-instant page load with a streaming fallback spinner.
 */
export async function DashboardDataLoader({ token, userId }: { token: string; userId: string }) {
  let initialData = null;
  try {
    logger.dev('[Dashboard] Fetching initial data server-side', {
      context: 'dashboard-page',
      userId,
    });

    initialData = await fetchDashboardData(token);

    logger.dev('[Dashboard] Initial data fetched successfully', {
      context: 'dashboard-page',
      hasCourses: !!initialData.courses,
      hasAttendance: !!initialData.attendance,
    });
  } catch (error) {
    // Graceful degradation – client will refetch on mount
    logger.error('[Dashboard] Failed to fetch initial data', {
      context: 'dashboard-page',
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
  }

  return <DashboardClient initialData={initialData} />;
}

export default async function DashboardPage() {
  // 1. Check authentication (fast – reads existing session cookie, no external I/O)
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    logger.dev('[Dashboard] User not authenticated, redirecting', {
      context: 'dashboard-page',
    });
    redirect("/");
  }

  // 2. Get EzyGo access token
  const cookieStore = await cookies();
  const token = cookieStore.get("ezygo_access_token")?.value;

  if (!token) {
    logger.warn('[Dashboard] EzyGo token missing, redirecting', {
      context: 'dashboard-page',
      userId: user.id,
    });
    redirect("/");
  }

  // 3. Stream data-dependent content – page shell renders immediately, then
  //    DashboardDataLoader flushes when fetchDashboardData resolves
  return (
    <Suspense fallback={<Loading />}>
      <DashboardDataLoader token={token} userId={user.id} />
    </Suspense>
  );
}