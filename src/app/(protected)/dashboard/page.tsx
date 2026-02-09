import { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import DashboardClient from "./DashboardClient";
import { fetchDashboardData } from "@/lib/ezygo-batch-fetcher";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// Force dynamic rendering for protected routes
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Dashboard",
  robots: {
    index: true,
    follow: true,
  },
};

export default async function DashboardPage() {
  // 1. Check authentication
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
  
  // 3. Fetch data server-side with deduplication and rate limiting
  // This prevents 20 concurrent users from making 120 API calls
  // Instead: max 3 concurrent calls with request deduplication
  let initialData = null;
  try {
    logger.dev('[Dashboard] Fetching initial data server-side', {
      context: 'dashboard-page',
      userId: user.id,
    });
    
    initialData = await fetchDashboardData(token);
    
    logger.dev('[Dashboard] Initial data fetched successfully', {
      context: 'dashboard-page',
      hasCourses: !!initialData.courses,
      hasAttendance: !!initialData.attendance,
    });
  } catch (error) {
    // Don't block page load - let client handle retries
    // This provides graceful degradation if EzyGo is slow/down
    logger.error('[Dashboard] Failed to fetch initial data', {
      context: 'dashboard-page',
      error: error instanceof Error ? error.message : String(error),
      userId: user.id,
    });
  }
  
  // 4. Pass to client component for hydration
  return <DashboardClient initialData={initialData} />;
}