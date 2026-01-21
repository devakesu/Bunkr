"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
  token: z.string().min(1, "CAPTCHA verification failed"),
});

export async function submitContactForm(formData: FormData) {
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    token: formData.get("cf-turnstile-response"),
  };

  // 1. Validate Input
  const result = contactSchema.safeParse(rawData);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }
  
  const { name, email, subject, message, token } = result.data;

  // 2. Verify CAPTCHA
  const verifyRes = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
      headers: { "Content-Type": "application/json" },
    }
  );
  const verifyData = await verifyRes.json();
  if (!verifyData.success) {
    return { error: "CAPTCHA validation failed. Are you a robot?" };
  }

  // 3. Get User Context (Read-Only check)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 4. Initialize Admin Client (Bypasses RLS for writing)
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let insertedId: string | null = null;

  try {
    // 5. Save to Database (Using ADMIN Client)
    const { data: insertedMessage, error: dbError } = await supabaseAdmin
      .from("contact_messages")
      .insert({
        user_id: user?.id || null,
        name,
        email,
        subject: subject || "New Contact Form Submission",
        message,
        status: 'new'
      })
      .select("id")
      .single();

    if (dbError) throw new Error(dbError.message);
    
    insertedId = insertedMessage.id;

    // 6. Send Notification to ADMIN
    const adminEmailResult = await sendEmail({
      to: "admin" + process.env.NEXT_PUBLIC_APP_EMAIL,
      subject: `[Contact Form] ${subject || "New Message"}`,
      html: `
        <h3>New Message from ${name} (${user ? "User" : "Guest"})</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject || "N/A"}</p>
        <p><strong>User ID:</strong> ${user?.id || "N/A"}</p>
        <p><strong>Message ID:</strong> ${insertedId}</p>
        <p><strong>Message:</strong><br/>${message.replace(/\n/g, "<br/>")}</p>
      `,
    });

    if (!adminEmailResult || !adminEmailResult.success) {
      throw new Error(`Admin email failed: ${adminEmailResult?.error || "Unknown error"}`);
    }

    // 7. Send Confirmation to USER (Fire and forget)
    // We do NOT rollback if this fails
    try {
      await sendEmail({
        to: email,
        subject: `We received your message: ${subject || "Contact Request"}`,
        html: `
          <h3>Hi ${name},</h3>
          <p>Thanks for reaching out to us. We have received your message and will get back to you as soon as possible.</p>
          <hr />
          <p style="color: #666; font-size: 14px;"><strong>Your Message:</strong><br/>${message.replace(/\n/g, "<br/>")}</p>
        `,
      });
    } catch (confirmationError) {
      console.warn("Failed to send user confirmation email:", confirmationError);
    }

    return { success: true };

  } catch (error: any) {
    console.error("Contact flow failed:", error);

    // 8. ROLLBACK (Using Admin Client)
    if (insertedId) {
      console.warn(`Rolling back: Deleting message ${insertedId}...`);
      
      const { error: deleteError } = await supabaseAdmin
        .from("contact_messages")
        .delete()
        .eq("id", insertedId);

      if (deleteError) {
        console.error("CRITICAL: Rollback failed!", deleteError);
      } else {
        console.log("Rollback successful.");
      }
    }

    console.error("SERVER ACTION ERROR:", error);
    return { error: "Failed to send message. Please try again." };
  }
}