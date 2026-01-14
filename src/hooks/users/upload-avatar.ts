import { createClient } from "@/lib/supabase/client";

export async function uploadUserAvatar(file: File) {
  const supabase = createClient();
  
  // 1. Get Current User
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("User not authenticated");

  // 2. Prepare File Path
  // Structure: {uuid}/{timestamp}.{ext} to prevent browser caching issues
  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${user.id}/${fileName}`;

  // 3. Upload File directly to Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // 4. Get Public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // 5. Update User Profile in DB
  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: publicUrl })
    .eq('auth_id', user.id);

  if (updateError) {
    throw new Error(`Profile update failed: ${updateError.message}`);
  }

  // 6. Cleanup: Delete old avatars in the background
  try {
    const { data: files } = await supabase.storage
      .from('avatars')
      .list(user.id);

    if (files && files.length > 0) {
      const filesToDelete = files
        .filter((f) => f.name !== fileName)
        .map((f) => `${user.id}/${f.name}`);

      if (filesToDelete.length > 0) {
        await supabase.storage.from('avatars').remove(filesToDelete);
      }
    }
  } catch (err) {
    console.warn("Background cleanup failed (non-critical):", err);
  }

  return publicUrl;
}