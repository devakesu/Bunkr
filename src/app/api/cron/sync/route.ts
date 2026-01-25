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
import { renderCourseMismatchEmail, renderAttendanceConflictEmail } from "@/lib/email-templates";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 10;

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
  if (!url || !key) throw new Error("Missing Supabase Admin credentials");
  return createAdminClient(url, key);
}

const getAttLabel = (code: number) => {
    switch (code) {
        case 110: return "Present";
        case 111: return "Absent";
        case 225: return "Duty Leave";
        case 112: return "Other Leave";
        default: return "Unknown";
    }
};

interface UserSyncData {
  username: string;
  email: string;
  ezygo_token: string;
  ezygo_iv: string;
  auth_id: string;
}

export async function GET(req: Request) {
  const supabaseAdmin = getAdminClient();
  
  // Validate required environment variables for email notifications
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not set - email dashboard links will be broken");
    return NextResponse.json(
      { error: "Server configuration error: NEXT_PUBLIC_APP_URL is not set" },
      { status: 500 }
    );
  }

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

  if (targetUsername) {
    const validation = UsernameSchema.safeParse(targetUsername);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid username format", details: validation.error.issues },
        { status: 400 }
      );
    }
  }

  const authHeader = req.headers.get('authorization');
  const isCron = authHeader?.replace('Bearer ', '') === process.env.CRON_SECRET;

  try {
    let usersToSync: UserSyncData[] = [];

    if (isCron) {
        let query = supabaseAdmin.from("users").select("username, email, ezygo_token, ezygo_iv, auth_id").not("ezygo_token", "is", null);
        if (targetUsername) query = query.eq("username", targetUsername);
        else query = query.order("last_synced_at", { ascending: true, nullsFirst: true }).limit(BATCH_SIZE);
        
        const { data, error } = await query;

        if (error) {
            return NextResponse.json(
              { error: "Database query failed", details: error.message },
              { status: 500 }
            );
        }
      
        if (data) usersToSync = data;
        
    } else {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const { data, error } = await supabaseAdmin.from("users").select("username, email, ezygo_token, ezygo_iv, auth_id").eq("auth_id", user.id).not("ezygo_token", "is", null);
        
        if (error) {
            return NextResponse.json(
              { error: "Database query failed", details: error.message },
              { status: 500 }
            );
        }

        if (data) usersToSync = data;
    }

    if (usersToSync.length === 0) return NextResponse.json({ message: "No eligible users" });

    const syncPromises = usersToSync.map(async (user) => {
      const userStats = { processed: 0, deletions: 0, conflicts: 0, updates: 0, errors: 0 };
      
      try {
        if (!user.ezygo_token || !user.ezygo_iv || !user.auth_id) {
          console.error(`Missing encryption data for user ${user.username}`);
          userStats.errors = 1;
          return userStats;
        }

        if (!/^[a-f0-9]{32}$/i.test(user.ezygo_iv)) {
          console.error(`Invalid IV format for user ${user.username}`);
          userStats.errors = 1;
          return userStats;
        }

        const decryptedToken = decrypt(user.ezygo_iv, user.ezygo_token);
        
        if (!decryptedToken || decryptedToken.length < 20) {
          console.error(`Invalid decrypted token for user ${user.username}`);
          userStats.errors = 1;
          return userStats;
        }

        // ---------------------------------------------------------
        // 1. FETCH COURSES
        // ---------------------------------------------------------
        let courseRes;
        try {
          courseRes = await axios.get(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}institutionuser/courses/withusers`,
            { 
              headers: { Authorization: `Bearer ${decryptedToken}` }, 
              timeout: 10000,
              validateStatus: (status) => status < 500
            }
          );
        } catch (axiosError: any) {
          if (axiosError.code === 'ECONNABORTED') {
            console.error(`Timeout fetching courses for ${user.username}`);
          } else if (axiosError.response?.status === 401) {
            console.error(`Token expired for ${user.username}`);
          } else {
            console.error(`Axios error for ${user.username}:`, axiosError.message);
          }
          userStats.errors = 1;
          return userStats;
        }

        if (courseRes.status !== 200 || !courseRes.data || !Array.isArray(courseRes.data)) {
          console.error(`Invalid courses response for user ${user.username}: status ${courseRes.status}`);
          userStats.errors = 1;
          return userStats;
        }

        const validatedCourses = courseRes.data
          .map(course => {
            const validation = CourseSchema.safeParse(course);
            if (!validation.success) {
              console.warn(`Invalid course data for ${user.username}:`, validation.error);
              return null;
            }
            return validation.data;
          })
          .filter(Boolean) as Course[];

        const coursesData = {
          courses: validatedCourses.reduce(
            (acc: Record<string, Course>, course) => {
              acc[course.id.toString()] = course;
              return acc;
            },
            {}
          ),
        };

        // ---------------------------------------------------------
        // 2. FETCH ATTENDANCE
        // ---------------------------------------------------------
        let attRes;
        try {
          attRes = await axios.post(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}attendancereports/student/detailed`, 
            {}, 
            { 
              headers: { Authorization: `Bearer ${decryptedToken}` }, 
              timeout: 20000,
              validateStatus: (status) => status < 500
            }
          );
        } catch (axiosError: any) {
          console.error(`Error fetching attendance for ${user.username}:`, axiosError.message);
          userStats.errors = 1;
          return userStats;
        }

        const officialData = attRes.data?.studentAttendanceData;

        if (!officialData || typeof officialData !== 'object') {
          console.error(`Invalid attendance response for user ${user.username}`);
          userStats.errors = 1;
          return userStats;
        }

        // ---------------------------------------------------------
        // 3. SYNC LOGIC
        // ---------------------------------------------------------
        const { data: trackingData, error: trackingError } = await supabaseAdmin
          .from("tracker")
          .select("id, course, date, session, attendance, status")
          .eq("auth_user_id", user.auth_id);

        if (trackingError) {
          console.error(`Failed to fetch tracking data for ${user.username}:`, trackingError);
          userStats.errors = 1;
          return userStats;
        }

        if (trackingData && trackingData.length > 0) {
            
            const officialMap = new Map<string, { code: number, course: string, course_name: string, session: string }>();
            
            Object.entries(officialData).forEach(([dateStr, dateObj]: [string, any]) => {
                Object.entries(dateObj).forEach(([sessionKey, session]: [string, any]) => {
                    if (session.class_type === "Revision") return;
                    
                    const rawSession = session.session || sessionKey;
                    const normalizedSession = toRoman(parseInt(normalizeSession(rawSession)) || rawSession);

                    const cId = String(session.course);
                    const cName = coursesData.courses[cId]?.name || cId;

                    officialMap.set(`${dateStr}|${normalizedSession}`, { 
                        code: Number(session.attendance),
                        course: cId,
                        course_name: cName,
                        session: rawSession
                    });
                });
            });

            const toDelete: number[] = [];
            const toUpdateStatus: number[] = [];
            const notifications: any[] = [];
            const emailsToSend: any[] = [];

            for (const item of trackingData) {

                if (!item.course || !item.date || !item.session) {
                    console.warn(`Incomplete tracking record for ${user.username}:`, item);
                    continue;
                }

                const normalizedTrackerSession = toRoman(parseInt(normalizeSession(item.session)) || item.session);
                const key = `${item.date}|${normalizedTrackerSession}`;
                
                if (officialMap.has(key)) {
                    const official = officialMap.get(key)!;
                    const officialCode = official.code;
                    const trackerCode = Number(item.attendance);
                    const courseLabel = official.course_name; 

                    // Course Mismatch
                    if (String(item.course) !== official.course) {
                        toDelete.push(item.id);
                        
                        if (item.status === 'extra') {
                            const manualCourseId = String(item.course);
                            const manualCourseName = coursesData.courses[manualCourseId]?.name || manualCourseId;

                            notifications.push({
                                auth_user_id: user.auth_id,
                                title: "Course Mismatch 💀",
                                description: `ACTION REQUIRED: Removed manual entry (${manualCourseName}) for Session ${item.session}. Official record shows ${courseLabel} was taken.`,
                                topic: `conflict-course-${key}`
                            });

                            if (user.email) {
                                emailsToSend.push({
                                    to: user.email,
                                    subject: `💀 Course Mismatch: ${manualCourseName}`,
                                    html: await renderCourseMismatchEmail({
                                        username: user.username,
                                        date: item.date,
                                        session: item.session,
                                        manualCourseName,
                                        courseLabel,
                                        dashboardUrl: `${appUrl}/dashboard`
                                    })
                                });
                            }
                        }
                        continue; 
                    }

                    const isOfficialPositive = officialCode === 110 || officialCode === 225 || officialCode === 112; 
                    const isOfficialAbsent = officialCode === 111;
                    const isTrackerPositive = trackerCode === 110 || trackerCode === 225 || trackerCode === 112;

                    // Sync / Delete
                    if (isOfficialPositive || officialCode === trackerCode) {
                        toDelete.push(item.id);
                        
                        if (isOfficialPositive && !isTrackerPositive) {
                        notifications.push({
                            auth_user_id: user.auth_id,
                            title: "Yayy!! 🥳 Attendance Updated",
                            description: `Official record updated to Present for ${courseLabel}. Manual (${getAttLabel(trackerCode)}) entry removed.`,
                            topic: `sync-surprise-${key}`
                        });
                        }
                        else if (officialCode !== trackerCode) {
                        notifications.push({
                            auth_user_id: user.auth_id,
                            title: "Yayy!! 🥳 Attendance Updated",
                            description: `Official record is ${getAttLabel(officialCode)} for ${courseLabel}. Your manual entry was removed.`,
                            topic: `sync-mismatch-${key}`
                        });
                        }
                        else {
                            notifications.push({
                            auth_user_id: user.auth_id,
                            title: "Attendance Verified ✅",
                            description: `Your manual entry for ${courseLabel} matched the official record (${getAttLabel(officialCode)}).`,
                            topic: `sync-verified-${key}`
                        });
                        }
                    }
                    // Conflict
                    else if (isOfficialAbsent && isTrackerPositive) {
                        if (item.status === 'extra') {
                            toUpdateStatus.push(item.id); 

                            notifications.push({
                                auth_user_id: user.auth_id,
                                title: "Attendance Conflict 💀",
                                description: `ACTION REQUIRED: Mismatch for ${courseLabel}. You self-marked as Present, but Official says Absent.`,
                                topic: `conflict-${key}`
                            });
                            userStats.conflicts++;

                            if (user.email) {
                                emailsToSend.push({
                                    to: user.email,
                                    subject: `💀 Attendance Conflict: ${courseLabel}`,
                                    html: await renderAttendanceConflictEmail({
                                        username: user.username,
                                        courseLabel,
                                        date: item.date,
                                        session: item.session,
                                        dashboardUrl: `${appUrl}/dashboard`
                                    })
                                });
                            }  
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
                await Promise.allSettled(emailsToSend.map(email => sendEmail(email)));
            }
        }

        await supabaseAdmin.from("users").update({ last_synced_at: new Date().toISOString() }).eq("auth_id", user.auth_id);
        userStats.processed = 1;

        return userStats;

      } catch (err: any) {
        console.error(`Sync failed for ${user.username}:`, {
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
        userStats.errors = 1;
        return userStats;
      }
    });

    const outcomes = await Promise.allSettled(syncPromises);
    const finalResults = outcomes.reduce((acc: any, outcome) => {
        if (outcome.status === 'fulfilled') {
            Object.keys(outcome.value).forEach(k => acc[k] = (acc[k] || 0) + outcome.value[k as keyof typeof outcome.value]);
        } else {
            acc.errors++;
        }
        return acc;
    }, { processed: 0, deletions: 0, conflicts: 0, updates: 0, errors: 0 });

    return NextResponse.json({ success: true, ...finalResults });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal Server Error",
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    }, { status: 500 });
  }
}