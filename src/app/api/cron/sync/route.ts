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

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 10; 

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

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = (forwardedFor?.split(",")[0] || "127.0.0.1").trim();
  const { success, reset, remaining } = await syncRateLimiter.limit(ip);

  if (!success) {
    return new Response(JSON.stringify({ error: "Too many requests", retryAfter: reset }), {
      status: 429, headers: { "X-RateLimit-Reset": reset.toString() }
    });
  }

  const { searchParams } = new URL(req.url);
  const targetUsername = searchParams.get('username');

  const authHeader = req.headers.get('authorization');
  const isCron = authHeader?.replace('Bearer ', '') === process.env.CRON_SECRET;

  try {
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

    if (usersToSync.length === 0) return NextResponse.json({ message: "No eligible users" });

    const syncPromises = usersToSync.map(async (user) => {
      const userStats = { processed: 0, deletions: 0, conflicts: 0, updates: 0, errors: 0 };
      
      try {
        if (!user.ezygo_token || !user.ezygo_iv) return userStats;
        const decryptedToken = decrypt(user.ezygo_iv, user.ezygo_token);
        
        // ---------------------------------------------------------
        // 1. FETCH COURSES
        // ---------------------------------------------------------
        const courseRes = await axios.get(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}institutionuser/courses/withusers`,
            { headers: { Authorization: `Bearer ${decryptedToken}` }, timeout: 10000 }
        );
        
        const coursesArray = courseRes.data || [];
        const coursesData = {
            courses: coursesArray.reduce(
                (acc: Record<string, Course>, course: Course) => {
                    acc[course.id.toString()] = course;
                    return acc;
                },
                {}
            ),
        };

        // ---------------------------------------------------------
        // 2. FETCH ATTENDANCE
        // ---------------------------------------------------------

        const attRes = await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}attendancereports/student/detailed`, 
          {}, 
          { headers: { Authorization: `Bearer ${decryptedToken}` }, timeout: 20000 }
        );
        const officialData = attRes.data?.studentAttendanceData;

        if (!officialData) return userStats;

        // ---------------------------------------------------------
        // 3. SYNC LOGIC
        // ---------------------------------------------------------
        const { data: trackingData } = await supabaseAdmin
          .from("tracker")
          .select("id, course, date, session, attendance, status")
          .eq("auth_user_id", user.auth_id);

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
            
            trackingData.forEach((item) => {
               const normalizedTrackerSession = toRoman(parseInt(normalizeSession(item.session)) || item.session);
               const key = `${item.date}|${normalizedTrackerSession}`;
               
               if (officialMap.has(key)) {
                 const official = officialMap.get(key)!;
                 const officialCode = official.code;
                 const trackerCode = Number(item.attendance);
                 const courseLabel = official.course_name; 

                // 🚨 CHECK 1: Course Mismatch
                if (String(item.course) !== official.course) {
                    toDelete.push(item.id);
                    if (item.status === 'extra') {
                        const manualCourseId = String(item.course);
                        const manualCourseName = coursesData.courses[manualCourseId]?.name || manualCourseId;

                        // 1. Notification
                        notifications.push({
                            auth_user_id: user.auth_id,
                            title: "Course Mismatch 💀",
                            description: `ACTION REQUIRED: Removed manual entry (${manualCourseName}) for Session ${item.session}. Official record shows ${courseLabel} was taken.`,
                            topic: `conflict-course-${key}`
                        });

                        // 2. Queue Email
                        if (user.email) {
                            emailsToSend.push({
                                to: user.email,
                                subject: `💀 Course Mismatch: ${manualCourseName}`,
                                html: `
                                <!DOCTYPE html>
                                <html>
                                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0;">
                                    
                                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
                                    
                                    <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 32px 20px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">GhostClass 👻</h1>
                                    </div>

                                    <div style="padding: 40px 30px;">
                                        <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">Course Mismatch Detected</h2>
                                        
                                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                                            Hi <strong>${user.username}</strong>,<br>
                                            We noticed a mix-up. You self-recorded a class for one course, but the official record shows a different one for that time slot.
                                        </p>

                                        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 20px;">
                                            <table style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe4e6; color: #be123c; font-size: 14px; font-weight: 600;">📅 Date</td>
                                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe4e6; color: #111827; text-align: right; font-size: 14px;">${item.date} - (${item.session})</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe4e6; color: #be123c; font-size: 14px; font-weight: 600;">👤 You Marked</td>
                                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe4e6; color: #111827; text-align: right; font-size: 14px; font-weight: 500;">
                                                        ${manualCourseName}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #be123c; font-size: 14px; font-weight: 600;">🏫 Official Record</td>
                                                    <td style="padding: 8px 0; color: #111827; text-align: right; font-size: 14px; font-weight: 700;">
                                                        ${courseLabel}
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>

                                        <p style="color: #6b7280; font-size: 14px; margin-top: 24px; line-height: 1.5; text-align: center;">
                                            To prevent confusion, we have <strong>removed your manual entry</strong>. Please check your dashboard for the correct status.
                                        </p>

                                        <div style="text-align: center; margin-top: 32px;">
                                            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #7c3aed; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.25);">
                                                Open Dashboard
                                            </a>
                                        </div>
                                    </div>

                                    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                            GhostClass 👻
                                        </p>
                                    </div>
                                    </div>
                                </body>
                                </html>
                                `
                            });
                        }
                    }
                    return; 
                }

                 const isOfficialPositive = officialCode === 110 || officialCode === 225 || officialCode === 112; 
                 const isOfficialAbsent = officialCode === 111;
                 const isTrackerPositive = trackerCode === 110 || trackerCode === 225 || trackerCode === 112;

                 // 🚨 CHECK 2: Sync / Delete
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
                 // 🚨 CHECK 3: Conflict
                 else if (isOfficialAbsent && isTrackerPositive) {
                     if (item.status === 'extra') {
                        toUpdateStatus.push(item.id);

                        // 1. Notification
                        notifications.push({
                            auth_user_id: user.auth_id,
                            title: "Attendance Conflict 💀",
                            description: `ACTION REQUIRED: Mismatch for ${courseLabel}. You self-marked as Present, but Official says Absent.`,
                            topic: `conflict-${key}`
                        });
                        userStats.conflicts++;

                        // 2. Queue Email
                         if (user.email) {
                            emailsToSend.push({
                                to: user.email,
                                subject: `💀 Attendance Conflict: ${courseLabel}`,
                                html: `
                                <!DOCTYPE html>
                                <html>
                                <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0;">
                                    
                                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
                                    
                                    <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 32px 20px; text-align: center;">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">GhostClass 👻</h1>
                                    </div>

                                    <div style="padding: 40px 30px;">
                                        <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">Attendance Conflict Detected</h2>
                                        
                                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                                            Hi <strong>${user.username}</strong>,<br>
                                            We found a discrepancy between your self-marked attendance and the official record.
                                        </p>

                                        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 20px;">
                                            <table style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe4e6; color: #be123c; font-size: 14px; font-weight: 600;">📚 Course</td>
                                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe4e6; color: #111827; text-align: right; font-size: 14px;">${courseLabel}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe4e6; color: #be123c; font-size: 14px; font-weight: 600;">📅 Date</td>
                                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe4e6; color: #111827; text-align: right; font-size: 14px;">${item.date} - (${item.session})</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe4e6; color: #be123c; font-size: 14px; font-weight: 600;">👤 You Marked</td>
                                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe4e6; text-align: right;">
                                                        <span style="background-color: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 12px;">Present</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #be123c; font-size: 14px; font-weight: 600;">🏫 Official</td>
                                                    <td style="padding: 8px 0; text-align: right;">
                                                        <span style="background-color: #fee2e2; color: #b91c1c; padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 12px;">Absent</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>

                                        <p style="color: #6b7280; font-size: 14px; margin-top: 24px; line-height: 1.5; text-align: center;">
                                            We have automatically flagged this entry as a <strong>Correction</strong> in your dashboard to keep your stats accurate.
                                        </p>

                                        <div style="text-align: center; margin-top: 32px;">
                                            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background-color: #7c3aed; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.25);">
                                                Open Dashboard
                                            </a>
                                        </div>
                                    </div>

                                    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                            GhostClass 👻
                                        </p>
                                    </div>
                                    </div>
                                </body>
                                </html>
                                `
                            });
                        }  
                     }
                 }
               }
            });

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

            // Send Emails asynchronously 
            if (emailsToSend.length > 0) {
                await Promise.allSettled(emailsToSend.map(email => sendEmail(email)));
            }
        }

        await supabaseAdmin.from("users").update({ last_synced_at: new Date().toISOString() }).eq("auth_id", user.auth_id);
        userStats.processed = 1;

        return userStats;

      } catch (err) {
        console.error(`Sync failed for ${user.username}`, err);
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

    return NextResponse.json({ success: true, ...finalResults }, { headers: { "X-RateLimit-Remaining": remaining.toString()}});

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}