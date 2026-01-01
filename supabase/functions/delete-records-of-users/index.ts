import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth Header Check
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please log in.' }), {
        status: 401, headers: corsHeaders 
      });
    }

    // 2. Verify Token with Ezygo
    const BASE_URL = Deno.env.get('BASE_URL');
    if (!BASE_URL) throw new Error("Missing BASE_URL secret");

    const authResponse = await fetch(BASE_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (!authResponse.ok) {
      return new Response(JSON.stringify({ error: 'Authorization error. Invalid token.' }), {
        status: 401, headers: corsHeaders
      });
    }

    // 3. Extract Verified User Info
    const authData = await authResponse.json();
    const authUser = authData.data || authData;
    const authUsername = authUser.username || authUser.user?.username;

    if (!authUsername) {
       return new Response(JSON.stringify({ error: 'Could not verify user identity from token.' }), {
        status: 403, headers: corsHeaders
      });
    }

    // 4. Parse Request Body
    const { username } = await req.json();

    if (!username) {
        return new Response(JSON.stringify({ error: "Username required" }), { 
            status: 400, headers: corsHeaders 
        });
    }

    // 5. SECURITY CHECK: Mismatch Protection
    // Ensure the user requesting the wipe is actually the user they claim to be
    if (username !== authUsername) {
        return new Response(JSON.stringify({ error: "Unauthorized: You cannot clear records for another user." }), {
        status: 403, headers: corsHeaders
      });
    }

    // 6. Initialize Supabase Admin
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "", 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 7. Delete Data
    const { error } = await supabase
        .from("tracker")
        .delete()
        .eq("username", authUsername);

    if (error) {
        console.error("Delete Error:", error);
        throw error;
    }

    return new Response(JSON.stringify({ success: true, message: "All tracking data cleared." }), { 
        status: 200, headers: corsHeaders 
    });

  } catch (err) {
    console.error("Function Error:", err);
    return new Response(JSON.stringify({ error: "Failed to clear data", details: err.message }), { 
        status: 500, headers: corsHeaders 
    });
  }
});