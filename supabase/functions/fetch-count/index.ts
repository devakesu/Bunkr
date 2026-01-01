import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': "Authorization, content-type, x-client-info, apikey",
  'Access-Control-Allow-Methods': "POST, OPTIONS",
  'Content-Type': "application/json"
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please log in.' }), { 
        status: 401, headers: corsHeaders 
      });
    }

    // 1. Verify Token with Ezygo
    const BASE_URL = Deno.env.get('BASE_URL');
    if (!BASE_URL) throw new Error("Missing BASE_URL secret");

    const authResponse = await fetch(BASE_URL, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
    });

    if (!authResponse.ok) {
      return new Response(JSON.stringify({ error: 'Invalid Token' }), { 
        status: 401, headers: corsHeaders 
      });
    }

    // 2. Extract Verified User Info
    const authData = await authResponse.json();
    const authUser = authData.data || authData;
    const authUsername = authUser.username || authUser.user?.username;

    if (!authUsername) {
        return new Response(JSON.stringify({ error: 'Could not verify user identity from token.' }), {
        status: 403, headers: corsHeaders
      });
    }

    // 3. Parse Request Body (Optional Validation)
    // Even if the frontend sends a username, we will use 'authUsername' for the query 
    // to guarantee they only see their own data.
    const body = await req.json().catch(() => ({}));
    const requestedUsername = body.username;

    // Explicitly reject mismatches (Strict Mode)
    if (requestedUsername && requestedUsername !== authUsername) {
         return new Response(JSON.stringify({ error: "Unauthorized: ID mismatch." }), { 
            status: 403, headers: corsHeaders 
         });
    }

    // 4. Initialize Supabase Admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 5. Query Count
    const { count, error } = await supabase
      .from('tracker')
      .select('*', { count: 'exact', head: true })
      .eq('username', authUsername); 

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      username: authUsername,
      count: count ?? 0
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error("Function Error:", err);
    return new Response(JSON.stringify({ error: err.message, success: false }), { 
        status: 500, headers: corsHeaders 
    });
  }
});