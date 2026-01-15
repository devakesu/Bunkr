import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server"; 
import axios from "axios";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { headers } from "next/headers";
import { syncRateLimiter } from "@/lib/ratelimit";
import { generateSlotKey, getOfficialSessionRaw } from "@/lib/logic/attendance-reconciliation";

export const dynamic = 'force-dynamic';

// --- CONFIG ---
const BATCH_SIZE = 20;

// Admin client for cron jobs (bypasses RLS)
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("Missing Supabase Admin credentials");
  }
  
  return createAdminClient(url, key);
}

interface UserSyncData {
  username: string;
  ezygo_token: string;
  ezygo_iv: string;
  auth_id: string;
}

export async function GET(req: Request) {
  
  const supabaseAdmin = getAdminClient();

  // 1. Rate Limiting (IP-based)
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for") ?? "127.0.0.1";
  const { success, limit, reset, remaining } = await syncRateLimiter.limit(ip);

  if (!success) {
    return new Response(JSON.stringify({ 
        error: "Too many requests. Slow down!",
        retryAfter: reset 
    }), {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    });
  }

  const { searchParams } = new URL(req.url);
  const targetUsername = searchParams.get('username');
  
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  const isCron = token === process.env.CRON_SECRET;

  try {
    let usersToSync: UserSyncData[] = [];

    // 2. Identify Users to Sync
    if (isCron) {
        if (targetUsername) {
            // Admin/Dev manually syncing a specific user via Cron endpoint
            const { data } = await supabaseAdmin
              .from("users")
              .select("username, ezygo_token, ezygo_iv, auth_id")
              .eq("username", targetUsername)
              .not("ezygo_token", "is", null);
            if (data) usersToSync = data;
        } else {
            // Standard Cron: Batch process
            const { data } = await supabaseAdmin
              .from("users")
              .select("username, ezygo_token, ezygo_iv, auth_id")
              .not("ezygo_token", "is", null)
              .order("last_synced_at", { ascending: true, nullsFirst: true })
              .limit(BATCH_SIZE);
            if (data) usersToSync = data;
        }
    } else {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const { data } = await supabaseAdmin
          .from("users")
          .select("username, ezygo_token, ezygo_iv, auth_id")
          .eq("auth_id", user.id)
          .not("ezygo_token", "is", null);
        if (data) usersToSync = data;
    }

    if (usersToSync.length === 0) {
        return NextResponse.json({ message: "No eligible users found" });
    }

    // 3. Process Sync
    const results = { processed: 0, deletions: 0, conflicts: 0, updates: 0, errors: 0 };

    for (const user of usersToSync) {
      try {
        if (!user.ezygo_token || !user.ezygo_iv) continue;

        // A. Decrypt Token & Fetch Official Data
        const decryptedToken = decrypt(user.ezygo_iv, user.ezygo_token);

        const ezygoRes = await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}attendancereports/student/detailed`, 
          {}, 
          { headers: { Authorization: `Bearer ${decryptedToken}` } }
        );
        const officialData = ezygoRes.data?.studentAttendanceData;

        if (!officialData) {
            console.warn(`No data returned for ${user.username}`);
            continue;
        }

        // B. Fetch Local Tracker Data
        const { data: trackingData } = await supabaseAdmin
          .from("tracker")
          .select("id, course, date, session, attendance, status")
          .eq("auth_user_id", user.auth_id);

        if (trackingData && trackingData.length > 0) {
            
            // Build Map for O(1) lookup
            const officialMap = new Map<string, number>();
            Object.entries(officialData).forEach(([dateStr, dateObj]: [string, any]) => {
                Object.entries(dateObj).forEach(([sessionKey, session]: [string, any]) => {
                    if (session.class_type === "Revision") return;
                    const rawSession = getOfficialSessionRaw(session, sessionKey);
                    const key = generateSlotKey(session.course, dateStr, rawSession);
                    officialMap.set(key, Number(session.attendance));
                });
            });

            const toDelete: number[] = [];
            const toUpdateStatus: number[] = [];
            
            const notifications: { 
                auth_user_id: string;
                title: string; 
                description: string; 
                topic: string; 
            }[] = [];
            
            trackingData.forEach((item) => {
               const key = generateSlotKey(item.course, item.date, item.session);
               
               if (officialMap.has(key)) {
                 const officialCode = officialMap.get(key)!;
                 const trackerCode = Number(item.attendance);

                 const isOfficialPositive = officialCode === 110 || officialCode === 225; 
                 const isOfficialAbsent = officialCode === 111;
                 const isTrackerPositive = trackerCode === 110 || trackerCode === 225;

                 // RULE 1: Sync (Delete if official matches tracker OR official is already positive)
                 // If the college marked you present, you don't need a manual "Present" entry anymore.
                 // If the college marked you absent, and you also marked "Absent" (tracking it), it's duplicate info.
                 if (isOfficialPositive || officialCode === trackerCode) {
                    toDelete.push(item.id);
                    
                    // Notify if we are cleaning up a manual "Absent" because college marked "Present"
                    if (isOfficialPositive && !isTrackerPositive) {
                       notifications.push({
                           auth_user_id: user.auth_id,
                           title: "Attendance Updated",
                           description: `Official record updated to Present for Course ${item.course}. Manual entry removed.`,
                           topic: "sync"
                       });
                    }
                 }
                 // RULE 2: Conflict (Official says Absent, You say Present)
                 else if (isOfficialAbsent && isTrackerPositive) {
                     if (item.status === 'extra') {
                         toUpdateStatus.push(item.id);
                     }

                     notifications.push({
                         auth_user_id: user.auth_id,
                         title: "Attendance Conflict",
                         description: `Mismatch for Course ${item.course}. You marked Present, Official says Absent.`,
                         topic: `conflict-${key}`
                     });
                     results.conflicts++;
                 }
               }
            });

            // Batch Operations
            if (toDelete.length > 0) {
               await supabaseAdmin.from("tracker").delete().in("id", toDelete);
               results.deletions += toDelete.length;
            }
            
            if (toUpdateStatus.length > 0) {
               await supabaseAdmin.from("tracker")
                 .update({ status: 'correction' })
                 .in("id", toUpdateStatus);
               results.updates += toUpdateStatus.length;
            }

            if (notifications.length > 0) {
               await supabaseAdmin.from("notification").insert(notifications);
            }
        }

        // Update timestamp
        await supabaseAdmin
            .from("users")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("auth_id", user.auth_id);
            
        results.processed++;

      } catch (err) {
        console.error(`Sync failed for ${user.username}`, err);
        results.errors++;
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}