// Crypto utility functions for encryption and decryption
// src/lib/crypto.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export const encrypt = (text: string) => {
  const secretKey = process.env.ENCRYPTION_KEY;
  if (!secretKey) {
    throw new Error("ENCRYPTION_KEY is not defined");
  }
  const KEY = Buffer.from(secretKey, 'hex');
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
  const secretKey = process.env.ENCRYPTION_KEY;
  if (!secretKey) {
    throw new Error("ENCRYPTION_KEY is not defined");
  }
  const KEY = Buffer.from(secretKey, 'hex');
  const [authTagHex, encryptedText] = content.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};