import * as Sentry from "@sentry/nextjs";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server"; 
import axios from "axios";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { headers } from "next/headers";
import { syncRateLimiter } from "@/lib/ratelimit";
import { toRoman, normalizeSession } from "@/lib/utils"; 
import { Course } from "@/types";
import { sendEmail } from "@/lib/email";
import { renderAttendanceConflictEmail } from "@/lib/email-templates";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 10;
// Keep concurrency low to avoid overwhelming the external EzyGo API.
// Each user sync makes 2 API calls (courses + attendance).
// CONCURRENCY_LIMIT=2 processes 2 users in parallel, limiting peak to 4 concurrent API calls.
const CONCURRENCY_LIMIT = 2;

// Validation schemas
const UsernameSchema = z.string()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9_.-]+$/, "Username contains invalid characters");

const CourseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  code: z.string().optional(),
});

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const error = new Error("Missing Supabase Admin credentials");
    Sentry.captureException(error);
    throw error;
  }
  return createAdminClient(url, key);
}

interface UserSyncData {
  username: string;
  email: string;
  ezygo_token: string;
  ezygo_iv: string;
  auth_id: string;
}

export async function GET(req: Request) {
  const supabaseAdmin = getAdminClient();
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    const error = new Error("NEXT_PUBLIC_APP_URL is not set");
    console.error(error);
    Sentry.captureException(error, { tags: { type: "config_error", location: "cron/sync" } });
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // 1. Rate Limit
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = (forwardedFor?.split(",")[0] || "127.0.0.1").trim();
  const { success, reset } = await syncRateLimiter.limit(ip);

  if (!success) {
    return new Response(JSON.stringify({ error: "Too many requests", retryAfter: reset }), {
      status: 429, headers: { "X-RateLimit-Reset": reset.toString() }
    });
  }

  const { searchParams } = new URL(req.url);
  const targetUsername = searchParams.get('username');
  if (targetUsername && !UsernameSchema.safeParse(targetUsername).success) {
     return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const authHeader = req.headers.get('authorization');
  const isCron = authHeader?.replace('Bearer ', '') === process.env.CRON_SECRET;

  try {
    // 2. Fetch Users
    let usersToSync: UserSyncData[] = [];
    if (isCron) {
        let query = supabaseAdmin.from("users").select("username, email, ezygo_token, ezygo_iv, auth_id").not("ezygo_token", "is", null);
        if (targetUsername) query = query.eq("username", targetUsername);
        else query = query.order("last_synced_at", { ascending: true, nullsFirst: true }).limit(BATCH_SIZE);
        const { data } = await query;
        if (data) usersToSync = data;
    } else {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const { data } = await supabaseAdmin.from("users").select("username, email, ezygo_token, ezygo_iv, auth_id").eq("auth_id", user.id).not("ezygo_token", "is", null);
        if (data) usersToSync = data;
    }

    if (usersToSync.length === 0) return NextResponse.json({ success: true, processed: 0 });

    // ---------------------------------------------------------
    // 3. CHUNKED PARALLEL PROCESSING
    // ---------------------------------------------------------
    const finalResults = { processed: 0, deletions: 0, conflicts: 0, updates: 0, errors: 0 };
    
    // Split users into chunks based on CONCURRENCY_LIMIT
    const chunks = [];
    for (let i = 0; i < usersToSync.length; i += CONCURRENCY_LIMIT) {
        chunks.push(usersToSync.slice(i, i + CONCURRENCY_LIMIT));
    }

    for (const chunk of chunks) {
        // Process users in this chunk concurrently
        const promises = chunk.map(async (user) => {
            try {
                if (!user.ezygo_token || !user.ezygo_iv || !user.auth_id) throw new Error("Missing credentials");

                const decryptedToken = decrypt(user.ezygo_iv, user.ezygo_token);
                if (!decryptedToken) throw new Error("Decryption failed");

                // A. Fetch Courses
                const courseRes = await axios.get(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}institutionuser/courses/withusers`,
                    { 
                        headers: { Authorization: `Bearer ${decryptedToken}` }, 
                        timeout: 8000, 
                        validateStatus: (status) => status < 500
                    }
                );
                
                if (courseRes.status !== 200 || !courseRes.data) throw new Error(`Courses API failed: ${courseRes.status}`);

                const validatedCourses = courseRes.data
                    .map((c: any) => CourseSchema.safeParse(c).success ? c : null)
                    .filter(Boolean) as Course[];
                
                const coursesMap = validatedCourses.reduce((acc, c) => ({ ...acc, [c.id]: c }), {} as Record<string, Course>);

                // B. Fetch Attendance
                const attRes = await axios.post(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}attendancereports/student/detailed`, 
                    {}, 
                    { 
                        headers: { Authorization: `Bearer ${decryptedToken}` }, 
                        timeout: 15000,
                        validateStatus: (status) => status < 500
                    }
                );

                if (attRes.status !== 200 || !attRes.data?.studentAttendanceData) throw new Error(`Attendance API failed: ${attRes.status}`);

                // C. Sync Logic
                const officialData = attRes.data.studentAttendanceData;
                const { data: trackingData } = await supabaseAdmin
                    .from("tracker")
                    .select("id, course, date, session, attendance, status")
                    .eq("auth_user_id", user.auth_id);

                if (trackingData && trackingData.length > 0) {
                    const officialMap = new Map<string, { code: number, course: string, course_name: string }>();
                    
                    Object.entries(officialData).forEach(([dateStr, dateObj]: [string, any]) => {
                        Object.entries(dateObj).forEach(([sessionKey, session]: [string, any]) => {
                            if (session.class_type === "Revision") return;
                            const rawSession = session.session || sessionKey;
                            const normalizedSession = toRoman(parseInt(normalizeSession(rawSession)) || rawSession);
                            
                            officialMap.set(`${dateStr}|${normalizedSession}`, { 
                                code: Number(session.attendance),
                                course: String(session.course),
                                course_name: coursesMap[String(session.course)]?.name || String(session.course)
                            });
                        });
                    });

                    const toDelete: number[] = [];
                    const toUpdateStatus: number[] = [];
                    const notifications: any[] = [];
                    const emailsToSend: any[] = [];

                    for (const item of trackingData) {
                        const normalizedTrackerSession = toRoman(parseInt(normalizeSession(item.session)) || item.session);
                        const key = `${item.date}|${normalizedTrackerSession}`;
                        
                        if (officialMap.has(key)) {
                            const official = officialMap.get(key)!;
                            
                            // Course Mismatch
                            if (String(item.course) !== official.course) {
                                toDelete.push(item.id);
                                if (item.status === 'extra') {
                                    notifications.push({
                                        auth_user_id: user.auth_id,
                                        title: "Course Mismatch 💀",
                                        description: `Removed ${coursesMap[String(item.course)]?.name}. Official: ${official.course_name}`,
                                        topic: `conflict-course-${key}`
                                    });
                                }
                                continue;
                            }

                            const officialCode = official.code;
                            const trackerCode = Number(item.attendance);
                            const isOfficialPositive = [110, 225, 112].includes(officialCode);
                            const isTrackerPositive = [110, 225, 112].includes(trackerCode);

                            // Sync Logic
                            if (isOfficialPositive || officialCode === trackerCode) {
                                toDelete.push(item.id);
                                if (isOfficialPositive && !isTrackerPositive) {
                                    notifications.push({
                                        auth_user_id: user.auth_id,
                                        title: "Attendance Updated 🥳",
                                        description: `Official record is Present. Manual entry removed.`,
                                        topic: `sync-surprise-${key}`
                                    });
                                }
                            } else if (officialCode === 111 && isTrackerPositive && item.status === 'extra') {
                                toUpdateStatus.push(item.id);
                                finalResults.conflicts++;
                                notifications.push({
                                    auth_user_id: user.auth_id,
                                    title: "Attendance Conflict 💀",
                                    description: `Mismatch! You marked Present, Official says Absent.`,
                                    topic: `conflict-${key}`
                                });
                                
                                if (user.email) {
                                    emailsToSend.push({
                                        to: user.email,
                                        subject: `💀 Attendance Conflict: ${official.course_name}`,
                                        html: await renderAttendanceConflictEmail({
                                            username: user.username,
                                            courseLabel: official.course_name,
                                            date: item.date,
                                            session: item.session,
                                            dashboardUrl: `${appUrl}/dashboard`
                                        })
                                    });
                                }
                            }
                        }
                    }

                    if (toDelete.length > 0) {
                        await supabaseAdmin.from("tracker").delete().in("id", toDelete);
                        finalResults.deletions += toDelete.length;
                    }
                    if (toUpdateStatus.length > 0) {
                        await supabaseAdmin.from("tracker").update({ status: 'correction' }).in("id", toUpdateStatus);
                        finalResults.updates += toUpdateStatus.length;
                    }
                    if (notifications.length > 0) {
                        await supabaseAdmin.from("notification").insert(notifications);
                    }
                    if (emailsToSend.length > 0) {
                        await Promise.allSettled(emailsToSend.map(e => sendEmail(e)));
                    }
                }

                await supabaseAdmin.from("users").update({ last_synced_at: new Date().toISOString() }).eq("auth_id", user.auth_id);
                finalResults.processed++;

            } catch (err: any) {
                console.error(`Sync failed for ${user.username}:`, err.message);
                finalResults.errors++;

                // CAPTURE INDIVIDUAL USER FAILURES
                Sentry.captureException(err, {
                    tags: { type: "sync_user_failure", location: "cron/sync" },
                    extra: { 
                        username: user.username,
                        user_id: user.auth_id
                    }
                });
            }
        });

        // Wait for this chunk to finish
        await Promise.allSettled(promises);
        
        // Small delay between chunks to respect rate limits (Optional: 1s)
        if (chunks.indexOf(chunk) < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Derive overall success and HTTP status from aggregated results
    const finalAny: any = finalResults as any;
    const totalUsers =
      typeof finalAny?.totalUsers === "number"
        ? finalAny.totalUsers
        : typeof finalAny?.total === "number"
          ? finalAny.total
          : 0;
    const errorCount =
      typeof finalAny?.errorCount === "number"
        ? finalAny.errorCount
        : typeof finalAny?.failed === "number"
          ? finalAny.failed
          : 0;

    let statusCode = 200;
    let successFlag = true;

    if (totalUsers > 0 && errorCount > 0) {
      const errorRate = errorCount / totalUsers;

      // All users failed to sync: treat as hard failure
      if (errorRate >= 1) {
        statusCode = 500;
        successFlag = false;
      } else {
        // Partial failure: indicate multi-status
        statusCode = 207;
        successFlag = false;
      }

      // Capture high error rates so they can be monitored/alerted
      Sentry.captureMessage("High error rate in cron/sync", {
        level: "error",
        tags: {
          type: "cron_partial_failure",
          location: "cron/sync",
        },
        extra: {
          totalUsers,
          errorCount,
          errorRate: errorCount / totalUsers,
        },
      });
    }

    return NextResponse.json({ success: successFlag, ...finalResults }, { status: statusCode });
  } catch (error: any) {
    console.error("Cron Error:", error);
    
    // CAPTURE GLOBAL CRON CRASH
    Sentry.captureException(error, {
        tags: { type: "cron_global_crash", location: "cron/sync" }
    });

    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}