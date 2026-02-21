// Crypto utility functions for encryption and decryption
// src/lib/crypto.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Cache for validated encryption key
let cachedKey: Buffer | null = null;

/**
 * Reset the cached encryption key (useful for testing)
 * @internal
 */
export function __resetCachedKey(): void {
  cachedKey = null;
}

// Lazy validation: validate and get key only when needed
// Note: This validation duplicates the checks in validateEnvironment() (validate-env.ts).
// This is intentional defense-in-depth to handle edge cases where validateEnvironment()
// might not run (e.g., in unit tests, CLI scripts, or non-standard entry points).
// In production, validateEnvironment() runs at server startup (app/layout.tsx) and will
// catch invalid keys before this function is ever called.
function getEncryptionKey(): Buffer {
  // Return cached key if already validated
  if (cachedKey) {
    return cachedKey;
  }
  
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not defined");
  }
  if (!/^[a-f0-9]{64}$/i.test(ENCRYPTION_KEY)) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  
  cachedKey = Buffer.from(ENCRYPTION_KEY, 'hex');
  return cachedKey;
}

export const encrypt = (text: string) => {

  if (!text || typeof text !== 'string') {
    throw new Error("Invalid input: text must be a non-empty string");
  }
  if (text.length > 100000) {
    throw new Error("Input text too long (max 100KB)");
  }

  const KEY = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  // TODO(security): NIST SP 800-38D recommends a 12-byte (96-bit) IV for AES-GCM for
  // maximum security margin and performance. The current 16-byte IV is cryptographically
  // valid but requires an extra GHASH step internally.
  //
  // Changing to 12 bytes is a BREAKING CHANGE — all existing ciphertext stored in the
  // database (ezygo_iv, auth_password_iv columns) uses 16-byte IVs and the decrypt()
  // function validates exactly 32 hex chars (16 bytes). A migration would be needed to:
  //   1. Re-encrypt all rows with a 12-byte IV (24 hex chars)
  //   2. Update the decrypt() regex to accept 24 hex chars
  //   3. Run a database migration
  // This is deferred until a scheduled maintenance window.
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    content: `${authTag}:${encrypted}`
  };
};

export const decrypt = (ivHex: string, content: string) => {

  if (!ivHex || !content) {
    throw new Error("Invalid input: IV and content are required");
  }
  if (!/^[a-f0-9]{32}$/i.test(ivHex)) {
    throw new Error("Invalid IV format (must be 32 hex chars)");
  }
  if (!content.includes(':')) {
    throw new Error("Invalid content format (missing separator)");
  }

  const parts = content.split(':');
  if (parts.length !== 2) {
    throw new Error("Invalid content format (unexpected separators)");
  }
  const [authTagHex, encryptedText] = parts;
  
  if (!/^[a-f0-9]+$/i.test(authTagHex) || !/^[a-f0-9]+$/i.test(encryptedText)) {
    throw new Error("Invalid content format (non-hex characters)");
  }

  const KEY = getEncryptionKey();
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (_error) {
    throw new Error("Decryption failed");
  }
};