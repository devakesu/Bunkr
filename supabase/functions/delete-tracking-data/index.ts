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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    // 1. Verify Token with Ezygo
    const BASE_URL = Deno.env.get('BASE_URL');
    if (!BASE_URL) throw new Error("Missing BASE_URL secret");

    const authResponse = await fetch(BASE_URL, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
    });

    if (!authResponse.ok) return new Response(JSON.stringify({ error: 'Invalid Token' }), { status: 401, headers: corsHeaders });

    // 2. Get Authenticated User Details
    const authData = await authResponse.json();
    const authUser = authData.data || authData;
    const authUsername = authUser.username || authUser.user?.username;

    if (!authUsername) {
        return new Response(JSON.stringify({ error: 'Could not verify identity from token' }), { status: 403, headers: corsHeaders });
    }

    // 3. Parse Request
    const { username, session, course, date } = await req.json();
    
    // 4. SECURITY CHECK: Ensure payload username matches token username
    if (username !== authUsername) {
        return new Response(JSON.stringify({ error: 'Unauthorized: You can only delete your own records' }), { status: 403, headers: corsHeaders });
    }

    if (!session || !course || !date) {
      return new Response(JSON.stringify({ success: false, error: 'Missing fields' }), { status: 400, headers: corsHeaders });
    }

    // 5. Perform Delete
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('tracker')
      .delete()
      .match({ username: authUsername, session, course, date })
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Record not found or mismatch' }), { status: 404, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, message: 'Deleted successfully' }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
});