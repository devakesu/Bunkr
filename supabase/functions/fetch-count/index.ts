import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  "Access-Control-Allow-Headers": "Authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const BASE_URL = Deno.env.get('BASE_URL');
    const response = await fetch(BASE_URL!, {
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

    const { username } = await req.json();
    if (!username) {
      return new Response(JSON.stringify({ error: "Username required" }), { status: 400, headers: corsHeaders });
    }

    const { count, error } = await supabase.from('tracker')
      .select('*', { count: 'exact', head: true })
      .eq('username', username);

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      username,
      count: count >= 0 ? count : 0
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, success: false }), { status: 500, headers: corsHeaders });
  }
});