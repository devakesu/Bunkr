// src/lib/email.ts
import axios from "axios";

// Types
interface SendEmailProps {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface ProviderResult {
  success: boolean;
  provider: "Brevo" | "SendPulse";
  id?: string;
  error?: any;
}

const hasBrevo = !!process.env.BREVO_API_KEY;
const hasSendPulse = !!(
  process.env.SENDPULSE_CLIENT_ID && 
  process.env.SENDPULSE_CLIENT_SECRET
);

const getSenderEmail = () => {
  const appEmail = process.env.NEXT_PUBLIC_APP_EMAIL;
  if (!appEmail) {
    throw new Error('NEXT_PUBLIC_APP_EMAIL is not configured');
  }
  return 'admin' + appEmail;
};

// Configuration
const CONFIG = {
  sender: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'GhostClass',
    email: getSenderEmail(),
  },
  brevo: {
    url: "https://api.brevo.com/v3/smtp/email",
    key: process.env.BREVO_API_KEY,
  },
  sendpulse: {
    authUrl: "https://api.sendpulse.com/oauth/access_token",
    emailUrl: "https://api.sendpulse.com/smtp/emails",
    clientId: process.env.SENDPULSE_CLIENT_ID,
    clientSecret: process.env.SENDPULSE_CLIENT_SECRET,
  },
};

/**
 * SendPulse Adapter
 */
async function getSendPulseToken() {
  if (!hasSendPulse) {
    throw new Error("SendPulse credentials not configured");
  }
  
  try {
    const res = await axios.post(CONFIG.sendpulse.authUrl, {
      grant_type: "client_credentials",
      client_id: CONFIG.sendpulse.clientId,
      client_secret: CONFIG.sendpulse.clientSecret,
    });
    return res.data.access_token;
  } catch (error) {
    console.error("Failed to get SendPulse token", error);
    throw new Error("SendPulse Auth Failed");
  }
}

async function sendViaSendPulse({ to, subject, html, text }: SendEmailProps): Promise<ProviderResult> {
  if (!hasSendPulse) {
    throw new Error("SendPulse not configured");
  }

  try {
    const token = await getSendPulseToken();

    const payload = {
      email: {
        html: Buffer.from(html).toString("base64"), 
        text: text || html.replace(/<[^>]*>?/gm, ""),
        subject,
        from: CONFIG.sender,
        to: [{ email: to, name: "User" }],
      },
    };

    const { data } = await axios.post(CONFIG.sendpulse.emailUrl, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { success: true, provider: "SendPulse", id: data.id };
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Brevo Adapter
 */
async function sendViaBrevo({ to, subject, html, text }: SendEmailProps): Promise<ProviderResult> {
  if (!hasBrevo) {
    throw new Error("Brevo not configured");
  }

  try {
    const payload = {
      sender: CONFIG.sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text || html.replace(/<[^>]*>?/gm, ""),
    };

    const { data } = await axios.post(CONFIG.brevo.url, payload, {
      headers: {
        "api-key": CONFIG.brevo.key,
        "content-type": "application/json",
        accept: "application/json",
      },
    });

    return { success: true, provider: "Brevo", id: data.messageId };
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Main Controller (Load Balancer & Failover)
 */
export async function sendEmail(props: SendEmailProps) {
  let primary: typeof sendViaSendPulse | typeof sendViaBrevo;
  let secondary: typeof sendViaSendPulse | typeof sendViaBrevo | null = null;
  let primaryName: string;

  // If both available, randomize
  if (hasBrevo && hasSendPulse) {
    const startWithSendPulse = Math.random() < 0.5;
    primary = startWithSendPulse ? sendViaSendPulse : sendViaBrevo;
    secondary = startWithSendPulse ? sendViaBrevo : sendViaSendPulse;
    primaryName = startWithSendPulse ? "SendPulse" : "Brevo";
  } 
  // If only one available, use it
  else if (hasSendPulse) {
    primary = sendViaSendPulse;
    primaryName = "SendPulse";
  } else if (hasBrevo) {
    primary = sendViaBrevo;
    primaryName = "Brevo";
  } else {
    // This should never happen due to startup validation
    throw new Error("No email provider configured");
  }

  try {
    // Attempt Primary
    return await primary(props);
  } catch (primaryError: any) {
    console.warn(`Primary provider (${primaryName}) failed:`, primaryError.message);

    // Try secondary if available
    if (secondary) {
      console.log("Switching to secondary provider...");
      try {
        return await secondary(props);
      } catch (secondaryError: any) {
        console.error("All email providers failed.");
        return {
          success: false,
          provider: "Brevo" as const,
          error: `Primary: ${primaryError.message} | Secondary: ${secondaryError.message}`,
        };
      }
    } else {
      // No secondary available
      return {
        success: false,
        provider: primaryName as "Brevo" | "SendPulse",
        error: primaryError.message,
      };
    }
  }
}