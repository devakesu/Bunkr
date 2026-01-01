export async function uploadUserAvatar(
  accessToken: string, // The Ezygo Token
  file: File
) {
  // Your Edge Function URL
  const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_API_URL}/upload-avatar`;

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`, // Send Ezygo token
      // Do NOT set 'Content-Type': 'multipart/form-data' manually here; 
      // fetch sets it automatically with the correct boundary for FormData
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Upload failed');
  }

  const data = await response.json();
  return data.publicUrl;
}