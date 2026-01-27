#!/usr/bin/env node

/**
 * sync-secrets.js - Push local .env values to GitHub Secrets
 * Works on Windows, macOS, and Linux
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

const log = {
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
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

  content.split('\n').forEach((line) => {
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
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

// Main function
function main() {
  // Check prerequisites
  if (!isGhInstalled()) {
    log.warning('Warning: GitHub CLI (gh) is not installed. Skipping secret sync.');
    log.warning('Install from: https://cli.github.com/');
    process.exit(0);
  }

  if (!isGhAuthenticated()) {
    log.warning('Warning: Not authenticated with GitHub CLI. Skipping secret sync.');
    log.warning('Run: gh auth login');
    process.exit(0);
  }

  const repo = getRepo();
  if (!repo) {
    log.warning('Warning: Could not detect repository. Skipping secret sync.');
    process.exit(0);
  }

  // Parse .env file
  const envPath = path.join(process.cwd(), '.env');
  const envConfig = parseEnvFile(envPath);

  if (!envConfig) {
    log.warning('Warning: .env file not found. Skipping secret sync.');
    process.exit(0);
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

  // Sync each secret
  for (const secretName of secretsToSync) {
    const secretValue = envConfig[secretName];

    if (!secretValue) {
      log.warning(`⊘ Skipping ${secretName} (not set in .env)`);
      skipCount++;
      continue;
    }

    if (setSecret(repo, secretName, secretValue)) {
      log.success(`✓ Synced ${secretName}`);
      successCount++;
    } else {
      log.error(`✗ Failed to sync ${secretName}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + colors.green + '═══════════════════════════════════════' + colors.reset);
  log.success('Sync Complete!');
  log.success(`  ✓ Success: ${successCount}`);
  if (skipCount > 0) {
    log.warning(`  ⊘ Skipped: ${skipCount}`);
  }
  if (errorCount > 0) {
    log.error(`  ✗ Errors: ${errorCount}`);
  }
  console.log(colors.green + '═══════════════════════════════════════' + colors.reset);

  // Don't fail even if some secrets failed
  process.exit(0);
}

main();