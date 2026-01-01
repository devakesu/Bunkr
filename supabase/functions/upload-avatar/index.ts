import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authorization Check
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Missing token.' }), {
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Verify Token with Ezygo
    const BASE_URL = Deno.env.get('BASE_URL');
    if (!BASE_URL) throw new Error("Server Configuration Error: Missing BASE_URL");

    const authResponse = await fetch(BASE_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (!authResponse.ok) {
      return new Response(JSON.stringify({ error: 'Session expired or invalid. Please log in again.' }), {
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const userData = await authResponse.json();
    const userId = userData.id || userData.data?.id; 
    
    if (!userId) {
       return new Response(JSON.stringify({ error: 'Invalid user data received from auth provider.' }), {
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Parse File
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No valid file uploaded' }), {
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validation: Type & Size
    if (!file.type.startsWith("image/")) {
        return new Response(JSON.stringify({ error: 'Only image files are allowed.' }), {
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
       return new Response(JSON.stringify({ error: 'File size exceeds 5MB limit.' }), {
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Supabase Client (Admin)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // check for existing avatar to delete later
    let oldAvatarPath: string | null = null;
    
    const { data: currentUser } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (currentUser?.avatar_url) {
      try {
        const urlParts = currentUser.avatar_url.split('/avatars/');
        if (urlParts.length > 1) {
          oldAvatarPath = urlParts[1]; 
        }
      } catch (err) {
        console.warn("Error parsing old avatar URL:", err);
      }
    }

    // 5. Upload New File
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error("Storage Upload Error:", uploadError);
      throw new Error("Failed to save image to storage.");
    }

    // 6. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // 7. Update User Profile (WITH ROLLBACK)
    const { error: updateError } = await supabase
      .from('users') 
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (updateError) {
      console.error("Database Update Error:", updateError);
      
      // ROLLBACK: Delete the NEW file because DB update failed
      console.log("Rolling back: Deleting orphaned new file...");
      await supabase.storage
        .from('avatars')
        .remove([filePath]);

      throw new Error("Failed to update user profile. Upload cancelled.");
    }

    // ==========================================
    // STEP 8: SUCCESS - Delete Old Avatar
    // ==========================================

    if (oldAvatarPath) {
      const { error: delError } = await supabase.storage
        .from('avatars')
        .remove([oldAvatarPath]);
        
      if (delError) {
        console.warn("Cleanup Warning: Failed to delete old avatar:", delError.message);
      } else {
        console.log("Cleanup Success: Deleted old avatar:", oldAvatarPath);
      }
    }

    // Return Success Response
    return new Response(JSON.stringify({ success: true, publicUrl }), {
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Edge Function Exception:", err);
    return new Response(JSON.stringify({
      error: err.message || 'Internal Server Error',
      success: false
    }), {
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});