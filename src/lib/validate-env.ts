// src/lib/validate-env.ts
/**
 * Validates required and critical environment variables at startup.
 * Throws an error and prevents app from starting if critical vars are missing or invalid.
 */
export function validateEnvironment() {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ============================================================================
  // CRITICAL - App won't work without these
  // ============================================================================
  
  // Security
  if (!process.env.ENCRYPTION_KEY) {
    errors.push('❌ ENCRYPTION_KEY is required');
  } else if (!/^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
    errors.push('❌ ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  if (!process.env.CRON_SECRET) {
    errors.push('❌ CRON_SECRET is required');
  }

  if (!process.env.GHOST_PASSWORD_SALT) {
    errors.push('❌ GHOST_PASSWORD_SALT is required');
  } else if (!/^[a-f0-9]{64}$/i.test(process.env.GHOST_PASSWORD_SALT)) {
    errors.push('❌ GHOST_PASSWORD_SALT must be 64 hex characters (32 bytes)');
  }

  // Supabase
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('❌ NEXT_PUBLIC_SUPABASE_URL is required');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('❌ SUPABASE_SERVICE_ROLE_KEY is required');
  }

  // Upstash Redis (Rate Limiting)
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    errors.push('❌ UPSTASH_REDIS_REST_URL is required');
  }
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    errors.push('❌ UPSTASH_REDIS_REST_TOKEN is required');
  }

  // Email Providers (AT LEAST ONE REQUIRED)
  const hasBrevo = !!process.env.BREVO_API_KEY;
  const hasSendPulse = !!(
    process.env.SENDPULSE_CLIENT_ID && 
    process.env.SENDPULSE_CLIENT_SECRET
  );

  if (!hasBrevo && !hasSendPulse) {
    errors.push('❌ At least ONE email provider must be configured:');
    errors.push('   - BREVO_API_KEY (option 1)');
    errors.push('   - SENDPULSE_CLIENT_ID + SENDPULSE_CLIENT_SECRET (option 2)');
  }

  // Cloudflare Turnstile
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    errors.push('❌ NEXT_PUBLIC_TURNSTILE_SITE_KEY is required');
  } else if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY === '1x00000000000000000000AA') {
    errors.push('❌ NEXT_PUBLIC_TURNSTILE_SITE_KEY is using TEST KEY!');
    errors.push('   Replace with production key from https://dash.cloudflare.com/');
  }

  if (!process.env.TURNSTILE_SECRET_KEY) {
    errors.push('❌ TURNSTILE_SECRET_KEY is required');
  } else if (process.env.TURNSTILE_SECRET_KEY === '1x0000000000000000000000000000000AA') {
    errors.push('❌ TURNSTILE_SECRET_KEY is using TEST KEY!');
    errors.push('   Replace with production key from https://dash.cloudflare.com/');
  }

  // App Configuration
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    errors.push('❌ NEXT_PUBLIC_APP_URL is required');
  } else {
    try {
      // Ensure it's a valid absolute URL (e.g. includes protocol like https://)
      // This matches usage elsewhere: new URL(process.env.NEXT_PUBLIC_APP_URL)
      // eslint-disable-next-line no-new
      new URL(process.env.NEXT_PUBLIC_APP_URL);
    } catch {
      errors.push('❌ NEXT_PUBLIC_APP_URL must be a valid absolute URL (e.g. https://example.com)');
    }
  }

  if (!process.env.NEXT_PUBLIC_APP_EMAIL) {
    errors.push('❌ NEXT_PUBLIC_APP_EMAIL is required (used for sender addresses)');
  } else if (!process.env.NEXT_PUBLIC_APP_EMAIL.includes('@')) {
    errors.push('❌ NEXT_PUBLIC_APP_EMAIL must contain "@" and be a valid email/suffix (e.g. support@example.com)');
  }

  // ============================================================================
  // OPTIONAL - App works but features may be limited
  // ============================================================================

  // Sentry (Error Monitoring)
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    warnings.push('⚠️  NEXT_PUBLIC_SENTRY_DSN not set - error monitoring disabled');
  }
  if (!process.env.SENTRY_AUTH_TOKEN) {
    warnings.push('⚠️  SENTRY_AUTH_TOKEN not set - source maps won\'t upload');
  }

  // Google Analytics
  if (!process.env.NEXT_PUBLIC_GA_ID) {
    warnings.push('ℹ️  NEXT_PUBLIC_GA_ID not set - analytics disabled (optional)');
  }

  // ============================================================================
  // REPORT RESULTS
  // ============================================================================

  if (errors.length > 0) {
    console.error('\n' + '='.repeat(80));
    console.error('🚨 CRITICAL: ENVIRONMENT VALIDATION FAILED');
    console.error('='.repeat(80));
    console.error('The following required environment variables are missing or invalid:\n');
    errors.forEach(error => console.error(error));
    console.error('\n' + '='.repeat(80));
    console.error('📚 Fix: Copy .example.env to .env and fill in all required values');
    console.error('📖 See README.md for setup instructions');
    console.error('='.repeat(80) + '\n');
    
    throw new Error('Environment validation failed - see errors above');
  }

  if (warnings.length > 0) {
    console.warn('\n' + '='.repeat(80));
    console.warn('⚠️  OPTIONAL ENVIRONMENT VARIABLES');
    console.warn('='.repeat(80));
    warnings.forEach(warning => console.warn(warning));
    console.warn('='.repeat(80) + '\n');
  }

  if (errors.length === 0) {
    console.log('✅ Environment validation passed');
  }
}