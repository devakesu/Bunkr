import { createClient } from "@/lib/supabase/client";
import * as Sentry from "@sentry/nextjs";

// Allowed MIME types for avatar uploads to prevent MIME type confusion attacks
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const;

// Map MIME types to file extensions
const MIME_TO_EXT: Record<typeof ALLOWED_IMAGE_TYPES[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

export async function uploadUserAvatar(file: File) {
  const supabase = createClient();
  
  // 1. Get Current User
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
      const err = new Error("User not authenticated during avatar upload");
      Sentry.captureException(err, { tags: { type: "avatar_auth_error", location: "uploadUserAvatar" } });
      throw err;
  }

  // 2. Validate MIME type to prevent MIME type confusion attacks
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
      const err = new Error(`Invalid file type: ${file.type}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
      Sentry.captureException(err, { 
          tags: { type: "avatar_invalid_mime", location: "uploadUserAvatar" },
          extra: { 
              userId: user.id,
              attemptedType: file.type,
              fileName: file.name
          }
      });
      throw err;
  }

  try {
      // 3. Prepare File Path - use extension from validated MIME type
      const fileExt = MIME_TO_EXT[file.type as typeof ALLOWED_IMAGE_TYPES[number]];
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // 4. Upload File directly to Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { 
            upsert: true,
            contentType: file.type
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // 5. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 6. Update User Profile in DB
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('auth_id', user.id);

      if (updateError) {
        await supabase.storage.from('avatars').remove([filePath]); 
        throw new Error(`Profile update failed: ${updateError.message}`);
      }

      // 7. Cleanup: Delete old avatars in the background
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