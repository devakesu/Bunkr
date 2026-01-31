"use server";

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { headers } from "next/headers";
import { syncRateLimiter } from "@/lib/ratelimit";
import { redact, getClientIp } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { validateCsrfToken } from "@/lib/security/csrf";

// VALIDATION SCHEMA
const contactSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name too long")
    .regex(/^[a-zA-Z\s'-]+$/, "Name contains invalid characters"),
  
  email: z
    .email("Invalid email format")
    .max(255, "Email too long")
    .transform(val => val.toLowerCase().trim()),
  
  subject: z.string()
    .max(200, "Subject too long")
    .transform(val => val.trim())
    .optional(),
  
  message: z.string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message too long")
    .transform(val => val.trim()),
  
  token: z.string()
    .min(20, "Invalid CAPTCHA token"),
  
  csrf_token: z.string()
    .min(1, "Missing CSRF token")
    .optional(),
});

// Sanitize HTML to prevent injection attacks while preserving safe formatting
const sanitizeForEmail = (text: string): string => {
  const normalizedText = text.replace(/\r\n?/g, "\n");
  const withBreaks = normalizedText.replace(/\n/g, "<br>");
  
  return sanitizeHtml(withBreaks, {
    allowedTags: ["br", "strong", "em", "b", "i"],
    allowedAttributes: {},
    disallowedTagsMode: "escape",
  });
};

const escapeHtml = (text: string) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// --- EMAIL STYLES & COMPONENTS ---
const BRAND_COLOR = "#7b75ff";
const BG_COLOR = "#f9fafb";
const CONTAINER_STYLE = `
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
  background-color: ${BG_COLOR}; 
  padding: 40px 20px;
  line-height: 1.6;
  color: #374151;
`;
const CARD_STYLE = `
  max-width: 600px; 
  margin: 0 auto; 
  background-color: #ffffff; 
  border-radius: 12px; 
  overflow: hidden; 
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
`;
const HEADER_STYLE = `
  background-color: ${BRAND_COLOR}; 
  padding: 30px 40px; 
  text-align: center;
`;
const BODY_STYLE = `padding: 40px;`;
const FOOTER_STYLE = `
  background-color: #f3f4f6; 
  padding: 20px; 
  text-align: center; 
  font-size: 12px; 
  color: #6b7280;
`;

/**
 * Gets the contact email address from environment variable.
 * Formats it with 'contact' prefix for contact form submissions.
 * 
 * @returns Contact email address
 * @throws {Error} If NEXT_PUBLIC_APP_EMAIL is not configured
 * 
 * @example
 * ```ts
 * const email = getContactEmail(); // Returns 'contact@example.com'
 * ```
 */
const getContactEmail = () => {
  const appEmail = process.env.NEXT_PUBLIC_APP_EMAIL;
  if (!appEmail) {
    throw new Error('NEXT_PUBLIC_APP_EMAIL is not configured');
  }
  return 'contact' + appEmail;
};

/**
 * Server action for processing contact form submissions with comprehensive security.
 * Implements honeypot, rate limiting, CSRF protection, CAPTCHA verification, and origin validation.
 * 
 * @param formData - Form data containing contact information and security tokens
 * @returns Success/error response with status message
 * 
 * Security Features:
 * - Honeypot field for bot detection
 * - IP-based rate limiting
 * - CSRF token validation
 * - Origin header validation
 * - Cloudflare Turnstile CAPTCHA
 * - Input sanitization and validation (Zod schema)
 * 
 * Process:
 * 1. Honeypot check
 * 2. CSRF validation
 * 3. Origin validation
 * 4. IP extraction and rate limiting
 * 5. Input validation (name, email, message)
 * 6. CAPTCHA verification
 * 7. Check for spam patterns
 * 8. Upsert user in database
 * 9. Send email notifications
 * 
 * @example
 * ```ts
 * const result = await submitContactForm(formData);
 * if (result.error) {
 *   console.error(result.error);
 * }
 * ```
 */
export async function submitContactForm(formData: FormData) {

  // HONEYPOT CHECK (anti-bot)
  const honeypot = formData.get("website"); 
  if (honeypot) {
    logger.warn("Honeypot triggered");
    return { error: "Invalid submission" };
  }

  // RATE LIMIT BY IP 
  const headerList = await headers();

  // CSRF PROTECTION
  // Validate CSRF token from FormData against cookie
  const csrfToken = formData.get("csrf_token") as string | null;
  const csrfValid = await validateCsrfToken(csrfToken);
  if (!csrfValid) {
    logger.warn("Invalid CSRF token in contact form submission");
    return { error: "Invalid security token. Please refresh and try again." };
  }

  // Server Actions have built-in CSRF protection through Next.js origin validation.
  // The framework automatically validates that requests come from the same origin.
  // We enforce additional origin validation below for defense-in-depth.
  
  // Enforce origin validation for all requests (skip in development)
  if (process.env.NODE_ENV !== "development") {
    const origin = headerList.get("origin");
    const host = headerList.get("host");
    if (!origin || !host) {
      return { error: "Invalid origin" };
    }

    try {
      // Use .hostname (not .host) to exclude port and properly handle IPv6 addresses
      const originHostname = new URL(origin).hostname.toLowerCase();
      const headerHostname = new URL(`http://${host}`).hostname.toLowerCase();
      
      if (originHostname !== headerHostname) {
        return { error: "Invalid origin" };
      }
    } catch {
      return { error: "Invalid origin" };
    }
  }

  const ip = getClientIp(headerList);
  if (!ip) {
    const relevantHeaders: Record<string, string | null> = {
      "cf-connecting-ip": headerList.get("cf-connecting-ip"),
      "x-real-ip": headerList.get("x-real-ip"),
      "x-forwarded-for": headerList.get("x-forwarded-for"),
    };
    const safeHeaders = Object.fromEntries(
      Object.entries(relevantHeaders).map(([k, v]) => [k, v ? redact("id", v) : null])
    );
    logger.error("Unable to determine client IP from headers in contact form", { headers: safeHeaders });
    Sentry.captureMessage("Unable to determine client IP from headers in contact form", {
      level: "warning",
      extra: { headers: safeHeaders },
    });
    return { error: "Unable to determine client IP" };
  }

  const { success } = await syncRateLimiter.limit(`contact:${ip}`);
  
  if (!success) {
    return { error: "Too many requests. Please try again later." };
  }
  
  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    token: formData.get("cf-turnstile-response"),
    csrf_token: formData.get("csrf_token"),
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

    // Sanitize inputs for Email
    const safeName = escapeHtml(name);
    const safeSubject = escapeHtml(subject || "General Inquiry");
    const safeMessage = sanitizeForEmail(message);
    const safeEmail = escapeHtml(email);
    const userType = user ? "Registered User" : "Guest Visitor";

    // 6. Send Notification to ADMIN
    const adminEmailResult = await sendEmail({
      to: getContactEmail(),
      subject: `[New Inquiry] ${safeSubject}`,
      html: `
        <div style="${CONTAINER_STYLE}">
          <div style="${CARD_STYLE}">
            <div style="${HEADER_STYLE}">
              <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">New Contact Submission</h2>
            </div>
            <div style="${BODY_STYLE}">
              <p style="margin-top: 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Sender Details</p>
              <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 100px;">Name:</td>
                  <td style="padding: 8px 0; font-weight: 500; color: #111827;">${safeName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Email:</td>
                  <td style="padding: 8px 0; font-weight: 500; color: #111827;">
                    <a href="mailto:${safeEmail}" style="color: ${BRAND_COLOR}; text-decoration: none;">${safeEmail}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Status:</td>
                  <td style="padding: 8px 0; font-weight: 500; color: #111827;">${userType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">ID:</td>
                  <td style="padding: 8px 0; font-family: monospace; color: #6b7280; font-size: 12px;">${insertedId}</td>
                </tr>
              </table>
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 25px; border-left: 4px solid ${BRAND_COLOR};">
                <p style="margin-top: 0; color: #6b7280; font-size: 12px; font-weight: bold; text-transform: uppercase;">Subject: ${safeSubject}</p>
                <div style="color: #374151; font-size: 16px;">${safeMessage}</div>
              </div>
            </div>
            <div style="${FOOTER_STYLE}">
              This is an automated notification from GhostClass System.
            </div>
          </div>
        </div>
      `,
    });

    if (!adminEmailResult || !adminEmailResult.success) {
      throw new Error(`Admin email failed: ${adminEmailResult?.error || "Unknown error"}`);
    }

    // 7. Send Confirmation to USER
    try {
      await sendEmail({
        to: email,
        subject: `We received your message: ${safeSubject}`,
        html: `
          <div style="${CONTAINER_STYLE}">
            <div style="${CARD_STYLE}">
              <div style="${HEADER_STYLE}">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">GhostClass</h1>
              </div>
              <div style="${BODY_STYLE}">
                <h3 style="margin-top: 0; color: #111827; font-size: 20px;">Hi ${safeName},</h3>
                <p style="color: #4b5563; font-size: 16px;">
                  Thanks for getting in touch! We've received your message and our team is looking into it. 
                </p>
                <p style="color: #4b5563; font-size: 16px;">
                  We typically respond within 24-48 hours. In the meantime, here's a copy of what you sent:
                </p>
                
                <div style="margin: 30px 0; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                  <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 600;">Subject: ${safeSubject}</p>
                  <p style="margin: 0; color: #374151; font-style: italic;">"${safeMessage}"</p>
                </div>

                <p style="color: #4b5563; font-size: 16px;">Best regards,<br/><strong style="color: #111827;">The GhostClass Team</strong></p>
              </div>
              <div style="${FOOTER_STYLE}">
                &copy; ${new Date().getFullYear()} GhostClass. All rights reserved.
              </div>
            </div>
          </div>
        `,
      });
    } catch (confirmationError) {
      logger.warn("Failed to send user confirmation email:", confirmationError);
      // Non-fatal error: Capture as warning
      Sentry.captureException(confirmationError, {
        level: "warning",
        tags: { type: "email_confirmation_failed", location: "contact_form" },
        extra: { email: redact("email", email), insertedId: insertedId }
      });
    }

    return { success: true };

  } catch (error: any) {
    logger.error("Contact flow failed:", error);

    // Capture the main failure
    Sentry.captureException(error, {
        tags: { type: "contact_form_failure", location: "contact_form" },
        extra: { 
            email: redact("email", email),
            has_inserted_db: !!insertedId,
            user_ip_truncated: ip.split('.').slice(0,3).join('.') + '.0',
        }
    });

    // 8. ROLLBACK (Using Admin Client)
    if (insertedId) {
      logger.warn(`Rolling back: Deleting message ${insertedId}...`);
      
      const { error: deleteError } = await supabaseAdmin
        .from("contact_messages")
        .delete()
        .eq("id", insertedId);

      if (deleteError) {
        logger.error("CRITICAL: Rollback failed!", deleteError);
        // Critical failure: Data inconsistency
        Sentry.captureException(deleteError, {
             tags: { type: "rollback_failed", location: "contact_form" },
             extra: { insertedId }
        });
      } else {
        logger.dev("Rollback successful.");
      }
    }

    return { error: "Failed to send message. Please try again." };
  }
}