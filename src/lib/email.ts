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

// Configuration
const CONFIG = {
  sender: {
    name: process.env.NEXT_PUBLIC_APP_NAME,
    email: 'admin' + process.env.NEXT_PUBLIC_APP_EMAIL,
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
 * ------------------------------------------------------------------
 * 1. SendPulse Adapter
 * Requirement: HTML must be Base64 encoded
 * ------------------------------------------------------------------
 */
async function getSendPulseToken() {
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

    return { success: true, provider: "SendPulse", id: data.id }; //
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * ------------------------------------------------------------------
 * 2. Brevo Adapter
 * Requirement: Raw HTML string in 'htmlContent'
 * ------------------------------------------------------------------
 */
async function sendViaBrevo({ to, subject, html, text }: SendEmailProps): Promise<ProviderResult> {
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
        "api-key": CONFIG.brevo.key, //
        "content-type": "application/json",
        accept: "application/json",
      },
    });

    return { success: true, provider: "Brevo", id: data.messageId }; //
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * ------------------------------------------------------------------
 * 3. Main Controller (Load Balancer & Failover)
 * ------------------------------------------------------------------
 */
export async function sendEmail(props: SendEmailProps) {
  const startWithSendPulse = Math.random() < 0.5;

  const primary = startWithSendPulse ? sendViaSendPulse : sendViaBrevo;
  const secondary = startWithSendPulse ? sendViaBrevo : sendViaSendPulse;
  const primaryName = startWithSendPulse ? "SendPulse" : "Brevo";

  try {
    // Attempt Primary
    return await primary(props);
  } catch (primaryError: any) {
    console.warn(`Primary provider (${primaryName}) failed:`, primaryError.message);
    console.log("Switching to secondary provider...");

    try {
      // Failover to Secondary
      return await secondary(props);
    } catch (secondaryError: any) {
      console.error("All email providers failed.");
      return {
        success: false,
        provider: "Brevo",
        error: `Primary: ${primaryError.message} | Secondary: ${secondaryError.message}`,
      };
    }
  }
}