"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server action for accepting terms and conditions.
 * Updates user record with acceptance timestamp and version.
 * Sets persistent cookie for terms acceptance tracking.
 * 
 * @param version - Terms version being accepted
 * @throws {Error} If user not authenticated or database update fails
 * 
 * Process:
 * 1. Authenticate user
 * 2. Update database with acceptance timestamp and version
 * 3. Set cookie with 1 year expiry
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
  
  revalidatePath("/dashboard");
}