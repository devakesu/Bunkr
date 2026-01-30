import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase browser client for client-side operations.
 * For use in Client Components and browser-side code.
 * 
 * Features:
 * - Automatic session management in browser
 * - localStorage-based persistence
 * - Optimized for client-side React components
 * 
 * @returns Configured Supabase browser client
 * 
 * @example
 * ```tsx
 * "use client";
 * 
 * const supabase = createClient();
 * const { data } = await supabase.from('users').select();
 * ```
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}