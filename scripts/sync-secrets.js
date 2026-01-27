#!/usr/bin/env node

/**
 * sync-secrets.js - Push local .env values to GitHub Secrets
 * Works on Windows, macOS, and Linux
 * Opt-in via pre-commit hook: Set SYNC_SECRETS=1 to enable
 * Fails if sync is unsuccessful to ensure secrets stay in sync
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

const log = {
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
};

// Check if gh CLI is installed
function isGhInstalled() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if authenticated with gh
function isGhAuthenticated() {
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Get repository name
function getRepo() {
  try {
    const result = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return result.trim();
  } catch {
    return null;
  }
}

// Parse .env file
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const envConfig = {};
  const content = fs.readFileSync(filePath, 'utf8');

  content.split(/\r?\n/).forEach((line) => {
    // Skip comments and empty lines
    if (!line || line.trim().startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Remove quotes if present
      value = value.replace(/^["']|["']$/g, '');

      envConfig[key] = value;
    }
  });

  return envConfig;
}

// Set GitHub secret
function setSecret(repo, name, value) {
  try {
    const command = `gh secret set ${name} --repo ${repo} --app actions`;
    execSync(command, {
      input: value,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return { success: true };
  } catch (error) {
    let message;
    if (error instanceof Error) {
      const stderr = error.stderr
        ? String(error.stderr).trim()
        : '';
      message = stderr ? `${error.message}: ${stderr}` : error.message;
    } else {
      message = String(error);
    }
    return { success: false, error: message };
  }
}

// Main function
function main() {
  log.info('🚀 GitHub Secrets Sync\n');

  // Auto-skip in CI environments (pre-commit hook already handles opt-in via SYNC_SECRETS=1)
  if (process.env.CI) {
    log.info('⏭️  Secret sync skipped in CI environment.\n');
    return;
  }
  // Check prerequisites - FAIL if not met
  if (!isGhInstalled()) {
    log.error('❌ ERROR: GitHub CLI (gh) is not installed.');
    log.error('📥 Install from: https://cli.github.com/');
    log.error('\nSync failed - GitHub CLI is required.');
    process.exit(1);
  }

  if (!isGhAuthenticated()) {
    log.error('❌ ERROR: Not authenticated with GitHub CLI.');
    log.error('🔐 Run: gh auth login');
    log.error('\nSync failed - authentication required.');
    process.exit(1);
  }

  const repo = getRepo();
  if (!repo) {
    log.error('❌ ERROR: Could not detect repository.');
    log.error('💡 Make sure you are in a Git repository with GitHub remote.');
    log.error('💡 Or run: gh repo set-default');
    log.error('\nSync failed - repository detection failed.');
    process.exit(1);
  }

  // Parse .env file - FAIL if not found
  const envPath = path.join(process.cwd(), '.env');
  const envConfig = parseEnvFile(envPath);

  if (!envConfig) {
    log.error('❌ ERROR: .env file not found.');
    log.error(`📁 Expected location: ${envPath}`);
    log.error('\nSync failed - .env file is required.');
    process.exit(1);
  }

  log.success(`🔄 Syncing secrets to: ${repo}\n`);

  // List of secrets to sync (BUILD-TIME ONLY)
  const secretsToSync = [
    'IMAGE_NAME',
    'SOURCE_DATE_EPOCH',
    'SENTRY_ORG',
    'SENTRY_PROJECT',
    'SENTRY_AUTH_TOKEN',
    'NEXT_PUBLIC_APP_NAME',
    'NEXT_PUBLIC_APP_VERSION',
    'NEXT_PUBLIC_APP_DOMAIN',
    'NEXT_PUBLIC_AUTHOR_NAME',
    'NEXT_PUBLIC_AUTHOR_URL',
    'NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE',
    'NEXT_PUBLIC_BACKEND_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_GITHUB_URL',
    'NEXT_PUBLIC_SENTRY_DSN',
    'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
    'NEXT_PUBLIC_GA_ID',
    'COOLIFY_BASE_URL',
    'COOLIFY_APP_ID',
    'COOLIFY_API_TOKEN',
  ];

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors = [];
  const missing = [];

  // Sync each secret
  for (const secretName of secretsToSync) {
    const secretValue = envConfig[secretName];

    if (!secretValue) {
      log.warning(`⊘ Skipping ${secretName} (not set in .env)`);
      missing.push(secretName);
      skipCount++;
      continue;
    }

    const result = setSecret(repo, secretName, secretValue);
    
    if (result.success) {
      log.success(`✓ Synced ${secretName}`);
      successCount++;
    } else {
      log.error(`✗ Failed to sync ${secretName}`);
      log.error(`  Error: ${result.error}`);
      errors.push({ name: secretName, error: result.error });
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + colors.cyan + '═══════════════════════════════════════' + colors.reset);
  log.info('📊 Sync Summary');
  console.log(colors.cyan + '═══════════════════════════════════════' + colors.reset);
  log.success(`  ✓ Successfully synced: ${successCount}`);
  
  if (skipCount > 0) {
    log.warning(`  ⊘ Skipped (not in .env): ${skipCount}`);
  }
  
  if (errorCount > 0) {
    log.error(`  ✗ Failed: ${errorCount}`);
  }
  
  console.log(colors.cyan + '═══════════════════════════════════════' + colors.reset);

  // Show missing secrets (warnings only)
  if (missing.length > 0) {
    log.warning('\n⚠️  Missing secrets in .env:');
    missing.forEach((name) => {
      log.warning(`   - ${name}`);
    });
  }

  // Show errors in detail
  if (errors.length > 0) {
    log.error('\n❌ Failed to sync the following secrets:');
    errors.forEach(({ name, error }) => {
      log.error(`   - ${name}`);
      log.error(`     ${error}`);
    });
    
    log.error('\n💡 Troubleshooting:');
    log.error('   1. Check GitHub CLI permissions: gh auth refresh -s admin:org');
    log.error('   2. Verify repository access: gh repo view');
    log.error('   3. Check secret names for special characters');
    
    log.error('\n🚨 Sync FAILED - Please fix errors above\n');
    process.exit(1);
  }

  // Success!
  log.success('\n✅ All secrets synced successfully!\n');
  process.exit(0);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  log.error('\n❌ Unexpected error:');
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
  log.error('\n🚨 Sync FAILED\n');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log.error('\n❌ Unexpected error:');
  const message = error instanceof Error ? error.message : String(error);
  log.error(message);
  log.error('\n🚨 Sync FAILED\n');
  process.exit(1);
});

main();