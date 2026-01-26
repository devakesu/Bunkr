import * as Sentry from "@sentry/nextjs";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { syncRateLimiter } from "@/lib/ratelimit";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import crypto from "crypto";
import { z } from "zod";
import { redis } from "@/lib/redis";

export const dynamic = 'force-dynamic';

// Validation schemas
const SaveTokenRequestSchema = z.object({
  token: z.string()
    .min(20, "Token too short")
    .max(2000, "Token too long")
    .regex(/^[A-Za-z0-9_\-.]+$/, "Invalid token format"),
});

const EzygoUserSchema = z.object({
  username: z.string().min(1).max(100),
  id: z.union([z.string(), z.number()]).transform(val => String(val)),
  email: z.email(),
  mobile: z.string().optional(),
});

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("Missing Supabase Admin credentials");
  }
  
  return createClient(url, key);
}

// Lock TTL in seconds - configurable via environment variable
const AUTH_LOCK_TTL = parseInt(process.env.AUTH_LOCK_TTL || '10', 10);

/**
 * Acquires a distributed lock for user authentication operations
 * to prevent race conditions during concurrent logins
 * @returns Lock value if acquired successfully, null otherwise
 */
async function acquireAuthLock(userId: string): Promise<string | null> {
  const lockKey = `auth_lock:${userId}`;
  const lockValue = crypto.randomBytes(16).toString('hex');
  
  try {
    // SET NX (only set if doesn't exist) with expiration
    const result = await redis.set(lockKey, lockValue, {
      nx: true,
      ex: AUTH_LOCK_TTL,
    });
    
    return result === 'OK' ? lockValue : null;
  } catch (error) {
    console.error('Failed to acquire auth lock:', error);
    Sentry.captureException(error, {
      tags: { type: 'redis_lock_error', location: 'acquire_auth_lock' },
      extra: { userId },
    });
    // Throw error to distinguish Redis failures from lock contention
    throw error;
  }
}

/**
 * Releases the distributed lock for user authentication operations
 * Uses atomic compare-and-delete to ensure only the lock owner can release it
 */
async function releaseAuthLock(userId: string, lockValue: string): Promise<void> {
  const lockKey = `auth_lock:${userId}`;
  
  try {
    // Lua script for atomic compare-and-delete
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    await redis.eval(luaScript, [lockKey], [lockValue]);
  } catch (error) {
    console.error('Failed to release auth lock:', error);
    Sentry.captureException(error, {
      tags: { type: 'redis_lock_error', location: 'release_auth_lock' },
      extra: { userId },
    });
  }
}

export async function POST(req: Request) {
  const supabaseAdmin = getAdminClient();

  // 1. Rate Limit Check
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = (forwardedFor ?? "127.0.0.1").split(",")[0].trim();
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

  try {
    const body = await req.json();
    
    const validation = SaveTokenRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          message: "Invalid request format",
          errors: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { token } = validation.data;

    // 2. Verify Token with EzyGo
    let verifiedUsername = "";
    let verifieduserId = "";
    
    try {
      const ezygoRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}user`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
          validateStatus: (status) => status < 500,
        }
      );

      if (ezygoRes.status === 401) {
        return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
      }
      
      if (ezygoRes.status !== 200) {
        console.error("Unexpected Ezygo response status:", ezygoRes.status);
        Sentry.captureException(new Error(`EzyGo Unexpected Status: ${ezygoRes.status}`), {
             tags: { type: "ezygo_api_error", location: "save_token" },
        });
        return NextResponse.json(
          { message: "Authentication service error" },
          { status: 502 }
        );
      }

      const userValidation = EzygoUserSchema.safeParse(ezygoRes.data);
      if (!userValidation.success) {
        console.error("Invalid Ezygo response:", userValidation.error);
        Sentry.captureException(userValidation.error, {
            tags: { type: "ezygo_schema_mismatch", location: "save_token" },
            extra: { data: ezygoRes.data }
        });
        return NextResponse.json(
          { message: "Invalid user data from authentication service" },
          { status: 502 }
        );
      }

      verifiedUsername = userValidation.data.username;
      verifieduserId = userValidation.data.id;

    } catch (err: any) {
      if (err.code === 'ECONNABORTED') {
        return NextResponse.json({ message: "Authentication service timeout" }, { status: 504 });
      }
      if (err.response?.status === 401) {
        return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
      }
      
      console.error("Ezygo verification error:", err);
      Sentry.captureException(err, { tags: { type: "ezygo_network_error", location: "save_token" } });
      
      return NextResponse.json({ message: "Authentication service error" }, { status: 502 });
    }

    if (!verifiedUsername || !verifieduserId) {
      return NextResponse.json({ message: "Could not verify user identity" }, { status: 401 });
    }

    // Sanitize User ID
    const sanitizedUserId = verifieduserId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitizedUserId !== verifieduserId) {
      return NextResponse.json({ message: "Invalid user identifier" }, { status: 400 });
    }

    // 3. Ghost Login Logic (Ephemeral Password)
    const ghostDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ghostclass.devakesu.com";
    const email = `ezygo_${sanitizedUserId}@${ghostDomain}`;
    
    // Validate Email Format
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const emailRegex = new RegExp(`^[a-zA-Z0-9_-]+@${escapeRegExp(ghostDomain)}$`);
    
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Invalid email format" }, { status: 500 });
    }

    // Generate a fresh random password for this session
    const ephemeralPassword = crypto.randomBytes(32).toString('hex');
    let userId: string | undefined;

    // Acquire lock to prevent concurrent password updates
    let lockValue: string | null = null;
    try {
      lockValue = await acquireAuthLock(verifieduserId);
    } catch (error) {
      // Redis error - fail fast
      console.error('Redis lock service unavailable:', error);
      return NextResponse.json(
        { message: "Authentication service temporarily unavailable" },
        { status: 503 }
      );
    }
    
    if (!lockValue) {
      // Lock is held by another request - client should retry
      return NextResponse.json(
        { message: "Another login is in progress. Please try again." },
        { status: 409 }
      );
    }

    try {
      // A. Try to Create User First
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: ephemeralPassword,
        email_confirm: true,
        user_metadata: { ezygo_id: verifieduserId },
      });

      if (createError) {
        // B. If User Exists -> Update Password
        if (createError.message?.toLowerCase().includes("already registered") || createError.status === 422) {
          // Let's use the 'users' table to resolve the Auth UUID
          const { data: existingMap } = await supabaseAdmin
              .from("users")
              .select("auth_id")
              .eq("id", verifieduserId)
              .single();

          const targetAuthId = existingMap?.auth_id;

          if (!targetAuthId) {
            // --- CASE 1: ORPHAN USER (Exists in Auth, missing in DB) ---
            console.warn(`Orphan Auth User detected for ${verifieduserId}. Initiating exhaustive cleanup...`);

            let orphanUserId: string | null = null;
            let page = 1;
            const PER_PAGE = 1000;
            let hasMore = true;

            // Paginated Search Loop
            while (hasMore) {
              const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ 
                page: page, 
                perPage: PER_PAGE 
              });

              if (listError) {
                 console.error("Failed to list users during cleanup:", listError);
                 throw listError;
              }

              const users = data.users || [];
              
              // Try to find the user in the current page
              const found = users.find(u => u.email === email);
              if (found) {
                orphanUserId = found.id;
                break;
              }

              if (users.length < PER_PAGE) {
                hasMore = false;
              } else {
                page++;
              }
            }

            if (orphanUserId) {
              // Delete the orphan Auth record
              const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(orphanUserId);
              if (deleteError) throw deleteError;
              
              console.log(`Deleted orphan user ${orphanUserId}. Retrying creation...`);

              // Retry Creation (Fresh Start)
              const { data: retryData, error: retryError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password: ephemeralPassword,
                email_confirm: true,
                user_metadata: { ezygo_id: verifieduserId },
              });

              if (retryError) throw retryError;
              userId = retryData.user.id;

            } else {
               const errorMsg = `Critical: 'User already registered' error, but email ${email} not found in Auth scan.`;
               console.error(errorMsg);
               
               // CAPTURE CRITICAL SYNC ERROR
               Sentry.captureException(new Error(errorMsg), {
                   tags: { type: "critical_auth_sync", location: "save_token" },
                   extra: { verifieduserId, email }
               });

               return NextResponse.json({ message: "Account synchronization error" }, { status: 500 });
            }

          } else {
            // --- CASE 2: NORMAL USER (Exists in both) ---
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
              targetAuthId,
              { password: ephemeralPassword }
            );

            if (updateError) throw updateError;
            userId = targetAuthId;
          }
          
        } else {
          throw createError;
        }
      } else {
        userId = createData.user.id;
      }
    } finally {
      // Always release the lock, even if an error occurred
      if (lockValue) {
        await releaseAuthLock(verifieduserId, lockValue);
      }
    }

    // 4. Sign In
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: ephemeralPassword,
    });

    if (signInError) throw signInError;

    // 5. Encrypt & Save Token
    const { iv, content } = encrypt(token);
    
    // Validate Encryption
    if (!iv || !content || !/^[a-f0-9]{32}$/i.test(iv)) {
      Sentry.captureException(new Error("Encryption failed during token save"), {
          extra: { userId }
      });
      return NextResponse.json({ message: "Encryption failed" }, { status: 500 });
    }

    const { error: dbError } = await supabaseAdmin
      .from("users")
      .upsert({ 
        id: verifieduserId,
        username: verifiedUsername,
        ezygo_token: content, 
        ezygo_iv: iv,
        auth_id: userId,
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (dbError) throw dbError;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Auth Bridge Failed:", error);
    
    // Capture Main Failure
    Sentry.captureException(error, {
        tags: { type: "auth_bridge_failure", location: "save_token" },
        extra: { ip_truncated: ip.split('.').slice(0,3).join('.') }
    });

    return NextResponse.json(
      {
        message: "Failed to establish secure session",
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      },
      { status: 500 }
    );
  }
}