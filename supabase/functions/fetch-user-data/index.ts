import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get Token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    // 2. Fetch User Details from Ezygo
    // Use BASE_URL to match the other functions
    const BASE_URL = Deno.env.get('BASE_URL');
    if (!BASE_URL) throw new Error("Missing BASE_URL secret");
    
    const ezygoRes = await fetch(BASE_URL, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    })

    if (!ezygoRes.ok) {
      throw new Error(`Failed to fetch from Ezygo: ${ezygoRes.status}`)
    }

    const userData = await ezygoRes.json()

    // 3. Upsert into Supabase
    // FIX: Use SERVICE_ROLE_KEY to bypass RLS policies
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // FIX: Map fields to match the 'users' table structure
    // Table columns: id, username, full_name, email, phone
    const { error } = await supabase.from('users').upsert({
      id: userData.id,
      username: userData.username,
      email: userData.email,
      phone: userData.mobile, // Map 'mobile' (API) to 'phone' (DB)
      full_name: userData.full_name || userData.name || "" // Handle potential name fields
    })

    if (error) {
      console.error("Supabase Upsert Error:", error);
      throw error;
    }

    return new Response(
      JSON.stringify(userData),
      { headers: corsHeaders }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: corsHeaders
      }
    )
  }
})