import * as Sentry from "@sentry/nextjs";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server"; 
import axios from "axios";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { headers } from "next/headers";
import { syncRateLimiter } from "@/lib/ratelimit";
import { toRoman, normalizeSession, redact, getClientIp } from "@/lib/utils"; 
import { Course } from "@/types";
import { sendEmail } from "@/lib/email";
import { renderAttendanceConflictEmail, renderCourseMismatchEmail } from "@/lib/email-templates";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getAdminClient } from "@/lib/supabase/admin";

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

// Sync statistics type
interface SyncStats {
  processed: number;
  deletions: number;
  conflicts: number;
  updates: number;
  errors: number;
}

// Create empty stats object
function createEmptyStats(): SyncStats {
  return { processed: 0, deletions: 0, conflicts: 0, updates: 0, errors: 0 };
}

// Aggregate stats from source into target
function aggregateStats(target: SyncStats, source: SyncStats): void {
  target.processed += source.processed;
  target.deletions += source.deletions;
  target.conflicts += source.conflicts;
  target.updates += source.updates;
  target.errors += source.errors;
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
    logger.error(error);
    Sentry.captureException(error, { tags: { type: "config_error", location: "cron/sync" } });
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const headerList = await headers();

  // Note: This cron endpoint is typically called by non-browser automation (e.g. Vercel Cron, GitHub Actions),
  // so we do not depend on Origin-based validation here. Authentication is handled via CRON_SECRET below.

  // 1. Authenticate FIRST — check CRON_SECRET before rate limiting to fast-reject
  // invalid requests without consuming rate-limit quota. Uses constant-time comparison
  // to prevent timing attacks.
  const authHeader = req.headers.get('authorization');
  let isCron = false;

  if (authHeader !== null) {
    const providedSecret = authHeader.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET ?? '';
    // Constant-time comparison: only proceed if lengths match and bytes are equal
    const isCronValid =
      cronSecret.length > 0 &&
      providedSecret.length === cronSecret.length &&
      crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(cronSecret));

    if (!isCronValid) {
      // Auth header was present but invalid — reject immediately before rate limiting
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    isCron = true;
  }

  // 2. Rate Limit (applied to the non-cron / user-auth path to prevent abuse)
  const ip = getClientIp(headerList);
  
  if (!isCron) {
    if (!ip) {
      if (process.env.NODE_ENV === "development") {
        // In development, fail fast if we cannot determine the client IP.
        // This avoids masking misconfigurations and ensures IP extraction is exercised before production.
        // Redact IP values to avoid leaking IPs if dev logs are aggregated or NODE_ENV is misconfigured.
        const cfIp = headerList.get("cf-connecting-ip");
        const realIp = headerList.get("x-real-ip");
        logger.warn("Unable to determine client IP in development; failing request to expose configuration issue", {
          headers: {
            "cf-connecting-ip": cfIp ? redact("id", cfIp) : null,
            "x-real-ip": realIp ? redact("id", realIp) : null,
          },
        });
        return NextResponse.json(
          { error: "Development configuration error: unable to determine client IP address" },
          { status: 500 },
        );
      } else {
        // In production, reject requests without a determinable IP to prevent rate limiting bypass
        // Log header presence (boolean) rather than values to avoid IP leakage
        logger.error("Unable to determine client IP for cron request", {
          headers: {
            "cf-connecting-ip": headerList.has("cf-connecting-ip"),
            "x-real-ip": headerList.has("x-real-ip"),
          },
        });
        return NextResponse.json({ error: "Unable to determine client IP address" }, { status: 400 });
      }
    }

    const { success, reset } = await syncRateLimiter.limit(ip);

    if (!success) {
      return new Response(JSON.stringify({ error: "Too many requests", retryAfter: reset }), {
        status: 429, headers: { "X-RateLimit-Reset": reset.toString() }
      });
    }
  }

  try {
    // 3. Parse query parameters
    const { searchParams } = new URL(req.url);
    const targetUsername = searchParams.get('username');
    if (targetUsername && !UsernameSchema.safeParse(targetUsername).success) {
       return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    // 4. Fetch Users
    let usersToSync: UserSyncData[] = [];
    if (isCron) {
        let query = supabaseAdmin.from("users").select("username, email, ezygo_token, ezygo_iv, auth_id").not("ezygo_token", "is", null);
        if (targetUsername) query = query.eq("username", targetUsername);
        else query = query.order("last_synced_at", { ascending: true, nullsFirst: true }).limit(BATCH_SIZE);
        const { data, error } = await query;
        if (error) {
          logger.error("Failed to fetch users for sync:", error);
          Sentry.captureException(error, { tags: { type: "db_query_error", location: "api/cron/sync", auth: "cron" } });
          return NextResponse.json({ error: "Failed to fetch users for sync" }, { status: 500 });
        }
        if (data) usersToSync = data;
    } else {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const { data, error } = await supabaseAdmin.from("users").select("username, email, ezygo_token, ezygo_iv, auth_id").eq("auth_id", user.id).not("ezygo_token", "is", null);
        if (error) {
          logger.error("Failed to fetch users for sync:", error);
          Sentry.captureException(error, { tags: { type: "db_query_error", location: "api/cron/sync", auth: "user" } });
          return NextResponse.json({ error: "Failed to fetch users for sync" }, { status: 500 });
        }
        if (data) usersToSync = data;
    }

    if (usersToSync.length === 0) return NextResponse.json({ success: true, processed: 0 });

    // ---------------------------------------------------------
    // 3. CHUNKED PARALLEL PROCESSING
    // ---------------------------------------------------------
    const finalResults = createEmptyStats();
    
    // Split users into chunks based on CONCURRENCY_LIMIT
    const chunks = [];
    for (let i = 0; i < usersToSync.length; i += CONCURRENCY_LIMIT) {
        chunks.push(usersToSync.slice(i, i + CONCURRENCY_LIMIT));
    }

    for (const chunk of chunks) {
        // Process users in this chunk concurrently
        const promises = chunk.map(async (user) => {
            // Per-user stats to avoid race conditions
            const userStats = createEmptyStats();
            
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
                                        description: `${item.date} (${item.session}): Removed ${coursesMap[String(item.course)]?.name}. Official: ${official.course_name}`,
                                        topic: `conflict-course-${key}`
                                    });

                                    if (user.email) {
                                        emailsToSend.push({
                                            to: user.email,
                                            subject: `💀 Course Conflict: ${official.course_name}`,
                                            html: await renderCourseMismatchEmail({
                                                username: user.username,
                                                date: item.date,
                                                session: item.session,
                                                manualCourseName: coursesMap[String(item.course)]?.name || String(item.course),
                                                courseLabel: official.course_name,
                                                dashboardUrl: `${appUrl}/dashboard`
                                            })
                                        });
                                    }
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
                                        description: `${official.course_name} - ${item.date} (${item.session}): Official record is Present. Manual entry removed.`,
                                        topic: `sync-surprise-${key}`
                                    });
                                }
                            } else if (officialCode === 111 && isTrackerPositive && item.status === 'extra') {
                                toUpdateStatus.push(item.id);
                                userStats.conflicts++;
                                notifications.push({
                                    auth_user_id: user.auth_id,
                                    title: "Attendance Conflict 💀",
                                    description: `${official.course_name} - ${item.date} (${item.session}): You marked Present, Official says Absent.`,
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
                        userStats.deletions += toDelete.length;
                    }
                    if (toUpdateStatus.length > 0) {
                        await supabaseAdmin.from("tracker").update({ status: 'correction' }).in("id", toUpdateStatus);
                        userStats.updates += toUpdateStatus.length;
                    }
                    if (notifications.length > 0) {
                        await supabaseAdmin.from("notification").insert(notifications);
                    }
                    if (emailsToSend.length > 0) {
                        await Promise.allSettled(emailsToSend.map(e => sendEmail(e)));
                    }
                }

                await supabaseAdmin.from("users").update({ last_synced_at: new Date().toISOString() }).eq("auth_id", user.auth_id);
                userStats.processed++;
                
                return userStats;

            } catch (err: any) {
                logger.error(`Sync failed for ${user.username}:`, err.message);
                userStats.errors++;

                // CAPTURE INDIVIDUAL USER FAILURES
                Sentry.captureException(err, {
                    tags: { type: "sync_user_failure", location: "cron/sync" },
                    extra: {
                        user_id: redact("id", user.auth_id)
                    }
                });
                
                return userStats;
            }
        });

        // Wait for this chunk to finish and aggregate results
        const results = await Promise.allSettled(promises);
        
        // Aggregate stats from all promises in this chunk
        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
                aggregateStats(finalResults, result.value);
            } else if (result.status === 'rejected') {
                // Ensure rejected user syncs are counted as errors
                finalResults.errors += 1;
                
                // Capture unexpected promise rejections so they are visible
                Sentry.captureException(result.reason, {
                    tags: { type: "sync_user_promise_rejection", location: "cron/sync" },
                });
            }
        });
        
        // Small delay between chunks to respect rate limits (Optional: 1s)
        if (chunks.indexOf(chunk) < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Derive overall success and HTTP status from aggregated results
    const totalUsers = usersToSync.length;
    const errorCount = finalResults.errors;

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
    logger.error("Cron Error:", error);
    
    // CAPTURE GLOBAL CRON CRASH
    Sentry.captureException(error, {
        tags: { type: "cron_global_crash", location: "cron/sync" }
    });

    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}