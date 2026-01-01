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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    // 1. Get Payload & Extract User ID
    const payloadBody = await req.json();
    const payloadData = payloadBody.data || payloadBody; 
    
    // Extract User ID Correctly (Handle Nested Structures)
    let payloadUserId = payloadData.id;
    if (payloadData.user && payloadData.user.id) {
        payloadUserId = payloadData.user.id;
    } else if (payloadData.user_id) {
        payloadUserId = payloadData.user_id;
    }

    if (!payloadUserId) throw new Error("Invalid payload: User ID missing");

    // 2. VERIFY IDENTITY with Ezygo
    const BASE_URL = Deno.env.get('BASE_URL');
    if (!BASE_URL) throw new Error("Missing BASE_URL secret");

    const verificationRes = await fetch(BASE_URL, {
      method: 'GET',
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
    });

    if (!verificationRes.ok) throw new Error("Invalid Token: Ezygo verification failed");
    
    const authBody = await verificationRes.json();
    const authUser = authBody.data || authBody;
    const authId = authUser.id;

    // Security Check
    if (String(authId) !== String(payloadUserId)) {
      return new Response(JSON.stringify({ error: "Unauthorized ID mismatch" }), { status: 403, headers: corsHeaders });
    }

    // 3. Initialize Supabase Admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. FETCH CURRENT SUPABASE DATA (READ BEFORE WRITE)
    // We need to see if data exists so we don't overwrite user edits.
    const { data: existingUser } = await supabase
      .from('users')
      .select('first_name, last_name, gender, birth_date')
      .eq('id', payloadUserId)
      .single();

    // 5. Prepare Data (Soft Sync Logic)
    // Helper: Use existing DB value if present; otherwise fallback to Ezygo payload.
    const resolve = (existingVal: any, newVal: any) => {
       if (existingVal && existingVal !== "" && existingVal !== null) return existingVal;
       return newVal || null;
    };

    // Parse names from Ezygo payload
    const incomingFullName = payloadData.full_name || payloadData.name || payloadData.student_name || "";
    let payloadFirst = payloadData.first_name;
    let payloadLast = payloadData.last_name;
    
    if (!payloadFirst && incomingFullName) {
      const parts = incomingFullName.trim().split(' ');
      if (parts.length > 0) {
        payloadFirst = parts[0];
        payloadLast = parts.slice(1).join(' ') || "";
      }
    }

    // Apply Soft Sync: Preserve edits, fill gaps
    const finalFirstName = resolve(existingUser?.first_name, payloadFirst);
    const finalLastName = resolve(existingUser?.last_name, payloadLast);
    const finalGender = resolve(existingUser?.gender, payloadData.gender || payloadData.sex);
    const finalBirthDate = resolve(existingUser?.birth_date, payloadData.birth_date || payloadData.dob || payloadData.date_of_birth);

    // 6. UPSERT
    // - Credentials (Email/Phone/Username): Always sync from Ezygo (Hard Sync)
    // - Profile (Name/DOB/Gender): Use the "Resolved" values (Soft Sync)
    const { error: upsertError } = await supabase.from('users').upsert({
      id: payloadUserId,
      username: payloadData.user?.username || payloadData.username, 
      email: payloadData.user?.email || payloadData.email,          
      phone: payloadData.user?.mobile || payloadData.mobile,        
      
      first_name: finalFirstName, 
      last_name: finalLastName,   
      birth_date: finalBirthDate,
      gender: finalGender
    })

    if (upsertError) {
      console.error("Upsert Error:", upsertError);
      throw upsertError;
    }

    // 7. Return Final Record
    const { data: finalUser, error: fetchError } = await supabase
      .from('users')
      .select('*, avatar_url')
      .eq('id', payloadUserId)
      .single();

    if (fetchError) throw fetchError;

    return new Response(JSON.stringify(finalUser), { headers: corsHeaders })

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: corsHeaders }
    )
  }
})