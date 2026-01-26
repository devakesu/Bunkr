import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";

export async function createClient() {
  const cookieStore = await cookies();
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
      const error = new Error("Supabase Environment Variables missing in Server Client");
      Sentry.captureException(error, { tags: { type: "config_critical", location: "createClient" } });
      throw error;
  }

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            // The 'setAll' method was called from a Server Component.
            // This can be ignored if you have middleware refreshing the session.
            if (process.env.NODE_ENV === 'development') {
                console.warn("Supabase cookie set ignored (Server Component context) - This is usually normal." + error);
            }
          }
        },
      },
    }
  );
}