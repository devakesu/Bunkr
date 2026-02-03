-- Migration: Add encrypted auth_password columns to users table for multi-device session support
-- Rationale: Stores canonical authentication password (encrypted) so all devices can use the same 
-- password without invalidating previous sessions when a new device logs in.
-- 
-- SECURITY:
-- - Passwords are encrypted with AES-256-GCM before storage
-- - IV (initialization vector) stored separately for decryption
-- - Uses same encryption pattern as ezygo_token storage for consistency

ALTER TABLE users ADD COLUMN auth_password TEXT;
ALTER TABLE users ADD COLUMN auth_password_iv TEXT;

-- Add check constraints to ensure both columns are set together or both are null
ALTER TABLE users ADD CONSTRAINT check_auth_password_consistency 
CHECK ((auth_password IS NULL AND auth_password_iv IS NULL) 
    OR (auth_password IS NOT NULL AND auth_password_iv IS NOT NULL));

-- Add check to ensure neither is empty string
ALTER TABLE users ADD CONSTRAINT check_auth_password_not_empty 
CHECK (auth_password IS NULL OR auth_password != '');

ALTER TABLE users ADD CONSTRAINT check_auth_password_iv_not_empty 
CHECK (auth_password_iv IS NULL OR auth_password_iv != '');
