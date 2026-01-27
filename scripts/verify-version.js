 
 

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Helper to extract NEXT_PUBLIC_APP_VERSION from any file content
function extractVersion(filePath) {
  if (!fs.existsSync(filePath)) return null;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Ignore comments
    if (trimmed.startsWith('#')) continue;
    
    // Strict check for the specific key
    if (trimmed.startsWith('NEXT_PUBLIC_APP_VERSION')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        // Return value stripped of quotes and spaces
        return parts[1].trim().replace(/^["']|["']$/g, ''); 
      }
    }
  }
  return undefined; // File exists but key is missing
}

try {
  console.log(`${YELLOW}🔍 Verifying version consistency...${RESET}`);

  // 1. Source of Truth: package.json
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;

  // 2. Lockfile
  const lockPath = path.join(process.cwd(), 'package-lock.json');
  const lockVersion = JSON.parse(fs.readFileSync(lockPath, 'utf8')).version;

  // 3. .env
  const envPath = path.join(process.cwd(), '.env');
  const envVersion = extractVersion(envPath);

  // 4. .example.env
  const exampleEnvPath = path.join(process.cwd(), '.example.env');
  const exampleEnvVersion = extractVersion(exampleEnvPath);

  // 5. Git Branch
  let branchName = 'unknown';
  try {
    branchName = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (e) { /* ignore if no git */ }
  const normalizedBranch = branchName.replace(/^(v|release\/)/, '');


  // --- LOGGING STATUS ---
  console.log(`   📦 package.json:     ${pkgVersion}`);
  console.log(`   🔐 package-lock.json: ${lockVersion}`);
  
  if (envVersion === null) console.log(`   📄 .env:             ${RED}MISSING FILE${RESET}`);
  else if (envVersion === undefined) console.log(`   📄 .env:             ${RED}KEY MISSING${RESET}`);
  else console.log(`   📄 .env:             ${envVersion}`);

  if (exampleEnvVersion === null) console.log(`   📝 .example.env:     ${RED}MISSING FILE${RESET}`);
  else if (exampleEnvVersion === undefined) console.log(`   📝 .example.env:     ${RED}KEY MISSING${RESET}`);
  else console.log(`   📝 .example.env:     ${exampleEnvVersion}`);

  console.log(`   🌿 Git Branch:       ${branchName}`);


  // --- VALIDATION LOGIC ---
  const errors = [];

  // Check 1: Lockfile
  if (pkgVersion !== lockVersion) {
    errors.push(`Lockfile mismatch: Run 'npm install' to sync package-lock.json.`);
  }

  // Check 2: .env
  if (envVersion === null) {
    errors.push(`Critical: .env file is missing.`);
  } else if (envVersion === undefined) {
    errors.push(`Critical: 'NEXT_PUBLIC_APP_VERSION' is missing from .env`);
  } else if (envVersion !== pkgVersion) {
    errors.push(`Mismatch: .env version (${envVersion}) !== package.json (${pkgVersion})`);
  }

  // Check 3: .example.env
  if (exampleEnvVersion === null) {
    errors.push(`Warning: .example.env file is missing (Good practice to keep it).`);
  } else if (exampleEnvVersion === undefined) {
    errors.push(`Critical: 'NEXT_PUBLIC_APP_VERSION' is missing from .example.env`);
  } else if (exampleEnvVersion !== pkgVersion) {
    errors.push(`Mismatch: .example.env version (${exampleEnvVersion}) !== package.json (${pkgVersion})`);
  }

  // Check 4: Branch (only for protected branches)
  const protectedBranches = ['main', 'master', 'dev', 'development', 'staging', 'HEAD'];
  const skipBranchPatterns = [/^copilot\//];
  const shouldSkipBranchCheck = protectedBranches.includes(branchName) || 
    skipBranchPatterns.some(pattern => pattern.test(branchName));
  
  if (!shouldSkipBranchCheck && normalizedBranch !== pkgVersion) {
    errors.push(`Branch mismatch: Branch '${branchName}' implies version '${normalizedBranch}', but package is '${pkgVersion}'`);
  }

  // --- FINAL RESULT ---
  if (errors.length > 0) {
    console.error(`\n${RED}⛔ VALIDATION FAILED:${RESET}`);
    errors.forEach(e => console.error(`${RED} - ${e}${RESET}`));
    process.exit(1); // Fail commit
  }

  console.log(`${GREEN}✅ All versions synchronized.${RESET}\n`);
  process.exit(0);

} catch (e) {
  console.error(`${RED}❌ Script Error: ${e.message}${RESET}`);
  process.exit(1);
}