import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import type { User as AuthUser } from "@supabase/auth-js";
import { syncRateLimiter } from "@/lib/ratelimit";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import crypto from "crypto";
import { z } from "zod";

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

export async function POST(req: Request) {

  const supabaseAdmin = getAdminClient();
  const GHOST_PASSWORD_SALT = process.env.GHOST_PASSWORD_SALT;
  if (!GHOST_PASSWORD_SALT) {
      console.error("Server Misconfiguration: Missing GHOST_PASSWORD_SALT");
      return NextResponse.json({ message: "Server configuration error" }, { status: 500 });
  }

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

      // Check status before validating response body
      if (ezygoRes.status === 401) {
        return new NextResponse("Invalid or expired token", { status: 401 });
      }
      
      if (ezygoRes.status !== 200) {
        console.error("Unexpected Ezygo response status:", ezygoRes.status);
        return new NextResponse(
          "Authentication service error",
          { status: 502 }
        );
      }

      // Validate EzyGo Response
      const userValidation = EzygoUserSchema.safeParse(ezygoRes.data);
      if (!userValidation.success) {
        console.error("Invalid Ezygo response:", userValidation.error);
        return new NextResponse(
          "Invalid user data from authentication service",
          { status: 502 }
        );
      }

      verifiedUsername = userValidation.data.username;
      verifieduserId = userValidation.data.id;

    } catch (err: any) {
      if (err.code === 'ECONNABORTED') {
        return new NextResponse("Authentication service timeout", { status: 504 });
      }
      if (err.response?.status === 401) {
        return new NextResponse("Invalid or expired token", { status: 401 });
      }
      console.error("Ezygo verification error:", err);
      return new NextResponse("Authentication service error", { status: 502 });
    }

    if (!verifiedUsername || !verifieduserId) {
      return new NextResponse("Could not verify user identity", { status: 401 });
    }

    // Sanitize User ID
    const sanitizedUserId = verifieduserId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitizedUserId !== verifieduserId) {
      console.warn(`User ID contained invalid characters: ${verifieduserId}`);
      return new NextResponse("Invalid user identifier", { status: 400 });
    }

    // 3. Ghost Login for Supabase
    const ghostDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ghostclass.devakesu.com";
    const email = `ezygo_${sanitizedUserId}@${ghostDomain}`;
    
    // Validate Email Format (derive from configured domain)
    const escapeRegExp = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const emailRegex = new RegExp(
      `^[a-zA-Z0-9_-]+@${escapeRegExp(ghostDomain)}$`
    );
    if (!emailRegex.test(email)) {
      return new NextResponse("Invalid email format", { status: 500 });
    }

    const ghostPassword = crypto
    .createHash('sha256')
    .update(`${verifieduserId}${GHOST_PASSWORD_SALT}`)
    .digest('hex');

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    let signUpUser: AuthUser | null = null;
    let retryData: any = null;
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: ghostPassword,
    });

    // If Sign In fails (User doesn't exist), Sign Up!
    if (signInError) {
      console.log(`User ${verifieduserId} (EzyGo) not found in Auth, creating...`);
      
      const { data: signUpDataTemp, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: ghostPassword,
        email_confirm: true,
        user_metadata: { ezygo_id: verifieduserId },
      });

      // IF USER ALREADY EXISTS, FORCE PASSWORD UPDATE
      if (signUpError) {
        if (signUpError.message?.includes("already registered")) {
          const { data: existingUser } = await supabaseAdmin
            .from("users")
            .select("auth_id")
            .eq("id", verifieduserId) 
            .single();
          
          if (existingUser?.auth_id) {
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
              existingUser.auth_id,
              {
                password: ghostPassword
              }
            );

            if (updateError) throw updateError;
          }
        } else {
          // For any other sign-up error, abort the flow immediately
          throw signUpError;
        }
      }

      signUpUser = signUpDataTemp.user;
      const { data: retryDataTemp, error: retryError } = await supabase.auth.signInWithPassword({
        email,
        password: ghostPassword,
      });

      if (retryError) throw retryError;
      retryData = retryDataTemp;
    }

    const userId = signInData?.user?.id || signUpUser?.id || retryData?.user?.id;

    // Validate UUID
    if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return NextResponse.json(
        { message: "Invalid user session" },
        { status: 500 }
      );
    }

    const { iv, content } = encrypt(token);

    // Validate Encryption Output
    if (!iv || !content || !/^[a-f0-9]{32}$/i.test(iv)) {
      return NextResponse.json(
        { message: "Encryption failed" },
        { status: 500 }
      );
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
    
    return NextResponse.json(
      {
        message: "Failed to establish secure session",
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      },
      { status: 500 }
    );
  }
}