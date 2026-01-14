import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { User } from "@supabase/supabase-js";
import { syncRateLimiter } from "@/lib/ratelimit";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {

  // 1. Rate Limit Check
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

  const { token } = await req.json();

  if (!token) {
    return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
  }

  // 2. Verify Token with EzyGo
  let verifiedUsername = "";
  let verifieduserId = "";
  try {
      const ezygoRes = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}user`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      verifiedUsername = ezygoRes.data.username;
      verifieduserId = ezygoRes.data.id;
  } catch (err) {
      return new NextResponse("Invalid or expired token" + err, { status: 401 });
  }

  if (!verifiedUsername) {
      return new NextResponse("Could not verify user identity", { status: 401 });
  }

  // 3. Ghost Login for Supabase User Auth
  const email = `ezygo_${verifieduserId}@ghostclass.devakesu.com`;
  const ghostPassword = `GHOST_${verifieduserId}_${process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10)}`;

  try {
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

    let signUpUser: User | null = null;
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

      if (signUpError) throw signUpError;
      signUpUser = signUpDataTemp.user;

      const { error: retryError } = await supabase.auth.signInWithPassword({
        email,
        password: ghostPassword,
      });

      if (retryError) throw retryError;
    }

    const userId = signInData?.user?.id || signUpUser?.id;
    const { iv, content } = encrypt(token);

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
    console.log("Auth Bridge Failed:", error);
    return NextResponse.json({ message: error.message + "Failed to establish secure session" }, { status: 500 });
  }
}