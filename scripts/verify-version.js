 
 

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

try {
  console.log(`${YELLOW}🔍 Verifying version consistency...${RESET}`);

  // 1. Get Package Version
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;

  // 2. Get Lockfile Version
  const lockPath = path.join(process.cwd(), 'package-lock.json');
  const lockVersion = JSON.parse(fs.readFileSync(lockPath, 'utf8')).version;

  // 3. Get .env Version (STRICT PARSING)
  const envPath = path.join(process.cwd(), '.env');
  let envVersion = null;

  if (!fs.existsSync(envPath)) {
    console.error(`${RED}❌ Error: .env file is missing!${RESET}`);
    process.exit(1);
  }

  const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  
  // Debug: Show we are searching
  // console.log(`${CYAN}   Scanning .env (${envLines.length} lines)...${RESET}`);

  for (const line of envLines) {
    const trimmed = line.trim();
    // Skip comments
    if (trimmed.startsWith('#')) continue;

    // Strict check for NEXT_PUBLIC_APP_VERSION only
    if (trimmed.startsWith('NEXT_PUBLIC_APP_VERSION')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        // Remove quotes and whitespace
        envVersion = parts[1].trim().replace(/^["']|["']$/g, ''); 
        break; // Stop after finding the first one
      }
    }
  }

  // 4. Get Branch
  const branchName = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  const normalizedBranch = branchName.replace(/^(v|release\/)/, '');

  // --- REPORTING ---
  console.log(`   📦 Package:     ${pkgVersion}`);
  console.log(`   🔐 Lockfile:    ${lockVersion}`);
  console.log(`   📄 .env:        ${envVersion || RED + 'MISSING (NEXT_PUBLIC_APP_VERSION)' + RESET}`);
  console.log(`   🌿 Branch:      ${branchName}`);

  const errors = [];

  // 1. Check Lockfile
  if (pkgVersion !== lockVersion) {
    errors.push(`Lockfile mismatch: Run 'npm i' to sync.`);
  }

  // 2. Check .env (The Critical Part)
  if (!envVersion) {
    errors.push(`Critical: 'NEXT_PUBLIC_APP_VERSION' is missing from .env`);
  } else if (envVersion !== pkgVersion) {
    errors.push(`Env mismatch: .env has '${envVersion}' but package.json has '${pkgVersion}'`);
  }

  // 3. Check Branch
  const protectedBranches = ['main', 'master', 'dev', 'development', 'staging', 'HEAD'];
  if (!protectedBranches.includes(branchName) && normalizedBranch !== pkgVersion) {
    errors.push(`Branch mismatch: '${branchName}' does not match '${pkgVersion}'`);
  }

  // --- FINAL DECISION ---
  if (errors.length > 0) {
    console.error(`\n${RED}⛔ VALIDATION FAILED:${RESET}`);
    errors.forEach(e => console.error(`${RED} - ${e}${RESET}`));
    process.exit(1); // Exit with error
  }

  console.log(`${GREEN}✅ Versions matched.${RESET}\n`);
  process.exit(0); // Exit success

} catch (e) {
  console.error(`${RED}❌ Script Error: ${e.message}${RESET}`);
  process.exit(1);
}