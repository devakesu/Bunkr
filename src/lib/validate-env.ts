// src/lib/validate-env.ts

/**
 * Validates required and critical environment variables at startup.
 * Throws an error and prevents app from starting if critical vars are missing or invalid.
 * * NOTE: This must only run on the server (instrumentation.ts or next.config.js).
 */
export function validateEnvironment() {
  // 1. Prevent Client-Side Execution
  // Secrets like CRON_SECRET are undefined in the browser, so this would falsely fail on the client.
  if (typeof window !== 'undefined') return;

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
  } else if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY.startsWith('1x0000')) {
    if (process.env.NODE_ENV === 'production') {
      errors.push('❌ NEXT_PUBLIC_TURNSTILE_SITE_KEY is using TEST KEY in production!');
    } else {
      warnings.push('⚠️  NEXT_PUBLIC_TURNSTILE_SITE_KEY is using Cloudflare test key (development only)');
    }
  }

  if (!process.env.TURNSTILE_SECRET_KEY) {
    errors.push('❌ TURNSTILE_SECRET_KEY is required');
  } else if (process.env.TURNSTILE_SECRET_KEY.startsWith('1x0000')) {
    if (process.env.NODE_ENV === 'production') {
      errors.push('❌ TURNSTILE_SECRET_KEY is using TEST KEY in production!');
    } else {
      warnings.push('⚠️  TURNSTILE_SECRET_KEY is using Cloudflare test key (development only)');
    }
  }

  // App Configuration
  if (!process.env.NEXT_PUBLIC_APP_NAME) {
    errors.push('❌ NEXT_PUBLIC_APP_NAME is required');
  }

  if (!process.env.NEXT_PUBLIC_APP_VERSION) {
    errors.push('❌ NEXT_PUBLIC_APP_VERSION is required');
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    errors.push('❌ NEXT_PUBLIC_APP_URL is required');
  } else {
    try {
      const url = new URL(process.env.NEXT_PUBLIC_APP_URL);
      if (url.pathname !== '/') {
         warnings.push(`⚠️  NEXT_PUBLIC_APP_URL contains a path '${url.pathname}' but should typically only specify the domain (e.g., https://example.com)`);
      }
      if (process.env.NEXT_PUBLIC_APP_URL.endsWith('/')) {
         warnings.push('⚠️  NEXT_PUBLIC_APP_URL ends with a slash. Recommended: remove the trailing slash.');
      }
    } catch {
      errors.push('❌ NEXT_PUBLIC_APP_URL must be a valid absolute URL (e.g. https://example.com)');
    }
  }

  if (!process.env.NEXT_PUBLIC_APP_DOMAIN) {
      errors.push('❌ NEXT_PUBLIC_APP_DOMAIN is required (e.g. "ghostclass.com")');
  }

  if (!process.env.NEXT_PUBLIC_APP_EMAIL) {
    errors.push('❌ NEXT_PUBLIC_APP_EMAIL is required (used for sender addresses)');
  } else if (!/^@[^@]+$/.test(process.env.NEXT_PUBLIC_APP_EMAIL)) {
    errors.push('❌ NEXT_PUBLIC_APP_EMAIL must start with "@" and be a valid email suffix (e.g. @example.com)');
  }

  if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
    errors.push('❌ NEXT_PUBLIC_BACKEND_URL is required (EzyGo API URL)');
  }

  if (!process.env.NEXT_PUBLIC_AUTHOR_NAME) {
    warnings.push('⚠️  NEXT_PUBLIC_AUTHOR_NAME not set');
  }

  if (!process.env.NEXT_PUBLIC_AUTHOR_URL) {
    warnings.push('⚠️  NEXT_PUBLIC_AUTHOR_URL not set');
  }

  if (!process.env.NEXT_PUBLIC_GITHUB_URL) {
    warnings.push('⚠️  NEXT_PUBLIC_GITHUB_URL not set');
  }

  if (!process.env.NEXT_PUBLIC_LEGAL_EMAIL) {
    warnings.push('⚠️  NEXT_PUBLIC_LEGAL_EMAIL not set');
  }

  if (!process.env.NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE) {
    warnings.push('⚠️  NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE not set');
  }

  // ============================================================================
  // OPTIONAL - App works but features may be limited
  // ============================================================================

  // Sentry (Error Monitoring)
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    warnings.push('⚠️  NEXT_PUBLIC_SENTRY_DSN not set - error monitoring disabled');
  }
  // SENTRY_AUTH_TOKEN is build-time only, often not available at runtime, so skipping warning

  if (!process.env.SENTRY_HASH_SALT) {
    if (process.env.NODE_ENV === 'production') {
      errors.push(
        '❌ SENTRY_HASH_SALT is required in production\n' +
        '   Used for: Redacting sensitive data (emails, IDs) in logs and error reports\n' +
        '   Generate with: openssl rand -base64 32\n' +
        '   Set in: Deployment environment variables (e.g., Coolify, Vercel, Docker)\n' +
        '   Treat with the same security as database credentials'
      );
    } else {
      warnings.push('⚠️  SENTRY_HASH_SALT not set - using development-only fallback');
    }
  }

  // Google Analytics
  if (!process.env.NEXT_PUBLIC_GA_ID) {
    warnings.push('ℹ️  NEXT_PUBLIC_GA_ID not set - analytics disabled (optional)');
  }

  // Attendance Target Minimum
  const attendanceTargetMin = process.env.ATTENDANCE_TARGET_MIN;
  if (attendanceTargetMin) {
    const minValue = parseInt(attendanceTargetMin, 10);
    if (isNaN(minValue) || minValue < 1 || minValue > 100) {
      errors.push('❌ ATTENDANCE_TARGET_MIN must be a number between 1 and 100 (default: 50)');
    }
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
    console.error('='.repeat(80) + '\n');
    
    // We throw an Error to stop the build/startup
    throw new Error('Environment validation failed');
  }

  if (warnings.length > 0) {
    console.warn('\n' + '='.repeat(80));
    console.warn('⚠️  OPTIONAL ENVIRONMENT VARIABLES');
    console.warn('='.repeat(80));
    warnings.forEach(warning => console.warn(warning));
    console.warn('='.repeat(80) + '\n');
  }

  // Only log success in dev to keep prod logs clean
  if (errors.length === 0 && process.env.NODE_ENV === 'development') {
    console.log('✅ Environment validation passed');
  }
}