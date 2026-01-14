"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { TERMS_VERSION } from "@/app/config/legal";

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
    value: TERMS_VERSION,
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  });
  revalidatePath("/dashboard");
}