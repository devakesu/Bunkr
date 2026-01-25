// Crypto utility functions for encryption and decryption
// src/lib/crypto.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY is not defined");
}
if (!/^[a-f0-9]{64}$/i.test(ENCRYPTION_KEY)) {
  throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
}

const KEY = Buffer.from(ENCRYPTION_KEY, 'hex');

export const encrypt = (text: string) => {

  if (!text || typeof text !== 'string') {
    throw new Error("Invalid input: text must be a non-empty string");
  }
  if (text.length > 100000) {
    throw new Error("Input text too long (max 100KB)");
  }

  const iv = crypto.randomBytes(16);
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

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error("Decryption failed");
  }
};