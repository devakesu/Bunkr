"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server action for accepting terms and conditions.
 * Updates user record with acceptance timestamp and version.
 * Sets persistent httpOnly cookie for terms acceptance tracking.
 * 
 * COOKIE SECURITY:
 * The terms_version cookie is set with httpOnly: true, which means:
 * - Cannot be accessed via JavaScript (document.cookie)
 * - Only readable by server-side code (middleware, API routes, server actions)
 * - Protected from XSS attacks
 * - Automatically included in requests to same origin
 * 
 * COOKIE BEHAVIOR:
 * - Development (NODE_ENV !== "production"): secure flag is false (allows HTTP)
 * - Production: secure flag is true (requires HTTPS)
 * - sameSite: "lax" (included in top-level navigation, not cross-site requests)
 * - maxAge: 1 year (persistent across browser sessions)
 * - path: "/" (available to all routes)
 * 
 * SERVER-SIDE ACCESS:
 * The cookie is read in src/proxy.ts middleware using request.cookies.get("terms_version")
 * to enforce terms acceptance before accessing protected routes. This is secure because:
 * - Middleware runs on server-side (Node.js or Edge runtime)
 * - Cookie is automatically included in requests via Set-Cookie/Cookie headers
 * 
 * RACE CONDITION MITIGATION:
 * To prevent race conditions where middleware might execute before the cookie is set:
 * 1. Cookie is set synchronously in this server action
 * 2. Multiple paths are revalidated to ensure Next.js updates its cache
 * 3. Client should wait for this action to complete before redirecting
 * 4. Middleware uses a redirect_count cookie (with 5-minute TTL) to handle edge cases
 * 
 * The combination of revalidation + redirect waiting + cookie-based loop detection
 * ensures reliable terms acceptance even under high latency conditions.
 * 
 * @param version - The terms version being accepted (must match current TERMS_VERSION)
 * @throws {Error} If database update fails
 */
 * - No client-side JavaScript can read or modify the cookie
 * 
 * @param version - Terms version being accepted
 * @throws {Error} If user not authenticated or database update fails
 * 
 * Process:
 * 1. Authenticate user
 * 2. Update database with acceptance timestamp and version
 * 3. Set httpOnly cookie with 1 year expiry
 * 4. Revalidate dashboard path
 * 
 * @example
 * ```ts
 * await acceptTermsAction("1.0.0");
 * ```
 */
export async function acceptTermsAction(version: string) {

  const supabase = await createClient(); 
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("users")
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: version,
    })
    .eq("auth_id", user.id);

  if (error) throw new Error(error.message);
  
  const cookieStore = await cookies();
  cookieStore.set({
    name: "terms_version",
    value: version,
    path: "/",
    maxAge: 31536000, // 1 year
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true, // Secure cookie - checked server-side in proxy.ts
  });
  
  // Revalidate multiple paths to ensure Next.js cache is updated before redirect
  // This helps prevent race conditions where middleware might not see the cookie immediately
  revalidatePath("/dashboard");
  revalidatePath("/accept-terms");
  revalidatePath("/", "layout"); // Revalidate the root layout to ensure middleware gets fresh data
}
}

/**
 * Server action to clear the terms_version cookie.
 * Should be called during logout or account deletion to avoid
 * persisting terms acceptance across different users on the same browser.
 */
export async function clearTermsVersionCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: "terms_version",
    value: "",
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}