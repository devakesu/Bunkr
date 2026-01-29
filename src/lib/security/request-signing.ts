// Request Signing for Sensitive API Calls
// src/lib/security/request-signing.ts
import crypto from "crypto";

/**
 * Signs a request payload with HMAC-SHA256
 * @param payload Request payload (should be JSON stringified)
 * @param timestamp Unix timestamp in seconds
 * @returns Signature string
 */
export function signRequest(payload: string, timestamp: number): string {
  const secret = getSigningSecret();
  const message = `${timestamp}.${payload}`;
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

/**
 * Verifies request signature
 * @param payload Original request payload (JSON stringified)
 * @param timestamp Request timestamp
 * @param signature Provided signature
 * @param maxAge Maximum age of request in seconds (default: 300 = 5 minutes)
 * @returns true if signature is valid and not expired
 * 
 * NOTE: This maxAge parameter is for request signing replay attack prevention.
 * CSRF token expiration is handled separately by cookie maxAge (TOKEN_TTL = 3600s in csrf.ts).
 * The browser automatically removes expired CSRF cookies, making them invalid for validation.
 */
export function verifyRequestSignature(
  payload: string,
  timestamp: number,
  signature: string,
  maxAge: number = 300
): boolean {
  try {
    // Check timestamp validity (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    const age = now - timestamp;
    
    if (age > maxAge || age < 0) {
      return false; // Request too old or timestamp in future
    }

    // Compute expected signature
    const expectedSignature = signRequest(payload, timestamp);

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Gets the signing secret from environment
 * Uses dedicated REQUEST_SIGNING_SECRET if available, falls back to ENCRYPTION_KEY
 * Note: In production, use separate secrets for encryption and signing for better security
 * @throws Error if no secret is configured
 */
function getSigningSecret(): string {
  const secret = process.env.REQUEST_SIGNING_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("REQUEST_SIGNING_SECRET or ENCRYPTION_KEY must be configured for request signing");
  }
  return secret;
}

/**
 * Extracts signature components from request headers
 * Expected headers:
 * - x-signature: The HMAC signature
 * - x-timestamp: Unix timestamp
 */
export function extractSignatureFromRequest(request: Request): {
  signature: string | null;
  timestamp: number | null;
} {
  const signature = request.headers.get("x-signature");
  const timestampHeader = request.headers.get("x-timestamp");
  const timestamp = timestampHeader ? parseInt(timestampHeader, 10) : null;

  return {
    signature,
    timestamp: timestamp && !isNaN(timestamp) ? timestamp : null,
  };
}

/**
 * Middleware helper: Validates signed request
 * @param request Request object
 * @returns true if signature is valid
 */
export async function validateSignedRequest(request: Request): Promise<boolean> {
  try {
    const { signature, timestamp } = extractSignatureFromRequest(request);

    if (!signature || !timestamp) {
      return false;
    }

    // Clone request before reading body to avoid consuming it
    const clonedRequest = request.clone();
    const body = await clonedRequest.text();

    return verifyRequestSignature(body, timestamp, signature);
  } catch {
    return false;
  }
}

/**
 * Client-side helper: Generates headers for signed request
 * Note: This should be used in Server Actions, not client components
 */
export function generateSignedHeaders(payload: string): {
  "x-signature": string;
  "x-timestamp": string;
} {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signRequest(payload, timestamp);

  return {
    "x-signature": signature,
    "x-timestamp": timestamp.toString(),
  };
}
