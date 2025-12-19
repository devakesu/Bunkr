import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  "Access-Control-Allow-Headers": "Authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Get the authorization header
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please log in.' }), {
        status: 401, headers: corsHeaders // Fixed: Use correct variable name for headers
      });
    }

    // 2. Verify Token with Ezygo (BASE_URL)
    const BASE_URL = Deno.env.get('BASE_URL');
    if (!BASE_URL) throw new Error("Missing BASE_URL secret");

    const response = await fetch(BASE_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Auth API error:", errorText);
      return new Response(JSON.stringify({ error: 'Authorization error. Please log in again.' }), {
        status: 401, headers: corsHeaders
      });
    }

    // 3. Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. Parse request
    const body = await req.json();
    const { username, course, date, session, semester, year } = body;

    // Validation - Fixed to allow '0'
    if (year === undefined || !username || !course || !session || !date) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: corsHeaders
      });
    }

    // 5. Insert Data
    const { data, error } = await supabase.from('tracker').insert([{
      username,
      course,
      date,
      session,
      semester,
      year: String(year) // Force string conversion
    }]).select().single();

    if (error) {
      return new Response(JSON.stringify({ success: false, error: "Error adding data to tracking!" }), {
        status: 500, headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200, headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message || 'Something went wrong in server.',
      success: false
    }), {
      status: 500, headers: corsHeaders
    });
  }
});