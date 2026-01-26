import { createClient } from "@/lib/supabase/client";
import * as Sentry from "@sentry/nextjs";

export async function uploadUserAvatar(file: File) {
  const supabase = createClient();
  
  // 1. Get Current User
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
      const err = new Error("User not authenticated during avatar upload");
      Sentry.captureException(err, { tags: { type: "avatar_auth_error", location: "uploadUserAvatar" } });
      throw err;
  }

  try {
      // 2. Prepare File Path
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // 3. Upload File directly to Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { 
            upsert: true,
            contentType: file.type
        });

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
        await supabase.storage.from('avatars').remove([filePath]); 
        throw new Error(`Profile update failed: ${updateError.message}`);
      }

      // 6. Cleanup: Delete old avatars in the background
      (async () => {
          try {
            const { data: files } = await supabase.storage
              .from('avatars')
              .list(user.id);

            if (files && files.length > 0) {
              const filesToDelete = files
                .filter((f) => f.name !== fileName) // Keep the new one
                .map((f) => `${user.id}/${f.name}`);

              if (filesToDelete.length > 0) {
                await supabase.storage.from('avatars').remove(filesToDelete);
              }
            }
          } catch (cleanupErr) {
            console.warn("Background cleanup failed (non-critical):", cleanupErr);
            Sentry.captureException(cleanupErr, { 
                level: "warning",
                tags: { type: "avatar_cleanup_fail", location: "uploadUserAvatar" } 
            });
          }
      })();

      return publicUrl;

  } catch (error: any) {
      console.error("Avatar Upload Flow Failed:", error);
      Sentry.captureException(error, {
          tags: { type: "avatar_upload_critical", location: "uploadUserAvatar" },
          extra: { 
              userId: user.id,
              fileSize: file.size,
              fileType: file.type
          }
      });
      throw error;
  }
}