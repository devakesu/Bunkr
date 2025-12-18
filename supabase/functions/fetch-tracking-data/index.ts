import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  "Access-Control-Allow-Headers": "Authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const BASE_URL = Deno.env.get('BASE_URL');
    if (!BASE_URL) throw new Error("Missing BASE_URL secret");

    const response = await fetch(BASE_URL, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Invalid Token' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { username } = body;

    if (!username) {
      return new Response(JSON.stringify({ success: false, error: "Username required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch Data
    const { data, error } = await supabase
      .from("tracker")
      .select("*")
      .eq("username", username)
      .order('id', { ascending: false }); // Optional: Show newest first

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
});