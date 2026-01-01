import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Authorization Header Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. VERIFY IDENTITY with Ezygo
    const BASE_URL = Deno.env.get('BASE_URL');
    if (!BASE_URL) throw new Error("Server Misconfiguration: Missing BASE_URL");

    const verificationRes = await fetch(BASE_URL, {
      method: 'GET',
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
    });

    if (!verificationRes.ok) {
      return new Response(JSON.stringify({ error: 'Invalid Token: Ezygo verification failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authData = await verificationRes.json();
    const authUserId = authData.id || authData.data?.id;

    if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Could not verify user identity from token' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Parse Request Body
    const { first_name, last_name, gender, birth_date } = await req.json();

    // 4. Initialize Supabase Admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 5. Update Supabase
    const { data, error } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        gender,
        birth_date
      })
      .eq('id', authUserId)
      .select()
      .single();

    if (error) {
        console.error("DB Update Error:", error);
        throw error;
    }

    return new Response(JSON.stringify(data), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("Update Profile Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});