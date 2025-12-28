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
        status: 401, headers: corsHeaders 
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
    
    const { 
      username, 
      course, 
      date, 
      session, 
      semester, 
      year, 
      status,     // Added status to destructuring
      attendance, // Numeric code (225 or 110)
      remarks 
    } = body;

    // Validation
    // We strictly require attendance code now for the calculator to work
    if (year === undefined || !username || !course || !session || !date || attendance === undefined) {
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
      year: String(year),
      status,      // Included status in the insert payload
      attendance,  // Insert numeric code
      remarks      // Insert remarks string
    }]).select().single();

    if (error) {
      console.error("Supabase Insert Error:", error); 
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