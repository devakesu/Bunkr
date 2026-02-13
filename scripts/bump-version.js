const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

// Helper function to get the latest semver tag from git
function getLatestSemverTag() {
  try {
    const tags = execSync('git tag -l').toString().trim();
    if (!tags) {
      return null;
    }
    
    const semverTags = tags.split('\n')
      .filter(tag => /^v\d+\.\d+\.\d+$/.test(tag))
      .map(tag => tag.substring(1)) // Remove 'v' prefix
      .sort((a, b) => compareSemver(a, b));
    
    return semverTags.length > 0 ? semverTags[semverTags.length - 1] : null;
  } catch (err) {
    console.warn(`${YELLOW}⚠️  Warning: Failed to retrieve latest git tag: ${err.message}${RESET}`);
    return null;
  }
}

// Helper function to compare semantic versions
function compareSemver(a, b) {
  // Validate inputs are valid semantic versions
  const semverPattern = /^\d+\.\d+\.\d+$/;
  if (!semverPattern.test(a) || !semverPattern.test(b)) {
    throw new Error(`Invalid semantic version format. Expected MAJOR.MINOR.PATCH (e.g., 1.2.3). Got: "${a}", "${b}"`);
  }
  
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (aParts[i] > bParts[i]) return 1;
    if (aParts[i] < bParts[i]) return -1;
  }
  return 0;
}

// Helper function to increment patch version
function incrementPatch(version) {
  // Validate input is a valid semantic version
  const semverPattern = /^\d+\.\d+\.\d+$/;
  if (!semverPattern.test(version)) {
    throw new Error(`Invalid semantic version: ${version}. Expected MAJOR.MINOR.PATCH (e.g., 1.2.3)`);
  }
  
  const parts = version.split('.').map(Number);
  parts[2] += 1;
  return parts.join('.');
}

try {
  console.log(`${YELLOW}🚀 Starting Auto-Version Bump...${RESET}`);

  // Detect if running in CI
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  // 1. Get current branch name
  let branchName = 'unknown';
  try {
    branchName = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (_err) {
    console.error(`${RED}❌ Failed to get git branch. Are you in a git repo?${RESET}`);
    process.exit(1);
  }

  let newVersion;

  // 2. Determine version based on context (CI main branch or local branch)
  if (isCI && branchName === 'main') {
    console.log(`${YELLOW}   ℹ️  Running in CI on main branch${RESET}`);
    
    // Read current package.json version
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.error(`${RED}❌ package.json not found${RESET}`);
      process.exit(1);
    }
    
    let packageJson;
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (err) {
      console.error(`${RED}❌ Failed to parse package.json: Invalid JSON format${RESET}`);
      if (err && err.message) {
        console.error(err.message);
      }
      process.exit(1);
    }
    
    const currentVersion = String(packageJson.version || '').trim();
    
    // Validate the version field contains a valid semantic version
    const semverPattern = /^\d+\.\d+\.\d+$/;
    if (!semverPattern.test(currentVersion)) {
      console.error(`${RED}❌ Invalid package.json version "${currentVersion}". Expected MAJOR.MINOR.PATCH (e.g., 1.2.3).${RESET}`);
      process.exit(1);
    }
    
    // Get latest semver tag
    const latestTag = getLatestSemverTag();
    
    console.log(`   📦 Current package.json version: ${GREEN}${currentVersion}${RESET}`);
    console.log(`   🏷️  Latest git tag: ${latestTag ? GREEN + latestTag + RESET : YELLOW + '<none>' + RESET}`);
    
    if (!latestTag) {
      // No tags exist, use package.json version
      newVersion = currentVersion;
      console.log(`   🎯 Using package.json version (no tags exist): ${GREEN}${newVersion}${RESET}`);
    } else {
      const comparison = compareSemver(currentVersion, latestTag);
      
      if (comparison > 0) {
        // package.json version > latest tag (from merged release branch)
        newVersion = currentVersion;
        console.log(`   🎯 Using package.json version (already bumped): ${GREEN}${newVersion}${RESET}`);
      } else if (comparison === 0) {
        // package.json version = latest tag (auto-increment patch)
        newVersion = incrementPatch(currentVersion);
        console.log(`   🎯 Auto-incrementing patch version: ${GREEN}${newVersion}${RESET}`);
      } else {
        // package.json version < latest tag (shouldn't happen, but handle it)
        newVersion = incrementPatch(latestTag);
        console.log(`${YELLOW}   ⚠  package.json < latest tag, incrementing from tag: ${GREEN}${newVersion}${RESET}`);
      }
    }
  } else {
    // Local branch: Extract version from branch name (existing behavior)
    const versionRegex = /(\d+\.\d+\.\d+)/;
    const match = branchName.match(versionRegex);

    if (!match) {
      console.log(`${YELLOW}ℹ️  Branch '${branchName}' does not contain a semantic version (x.y.z).`);
      console.log(`   Skipping version bump.${RESET}\n`);
      process.exit(0);
    }

    newVersion = match[1];
    console.log(`   🎯 Detected Target Version: ${GREEN}${newVersion}${RESET} (from branch '${branchName}')`);
  }

  // 3. Update package.json & package-lock.json
  try {
    execSync(`npm version ${newVersion} --no-git-tag-version --allow-same-version`, { stdio: 'ignore' });
    console.log(`${GREEN}   ✔ Updated package.json & package-lock.json${RESET}`);
  } catch (_err) {
    console.error(`${RED}   ❌ Failed to update package.json. Is the JSON valid?${RESET}`);
    process.exit(1);
  }

  // 4. Update .env and .example.env
  const envFiles = ['.env', '.example.env'];
  const keyToUpdate = 'NEXT_PUBLIC_APP_VERSION';

  envFiles.forEach(fileName => {
    const filePath = path.join(process.cwd(), fileName);
    
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Regex to find the key and replace its value
      const keyRegex = new RegExp(`^${keyToUpdate}=.*$`, 'gm');
      const newLine = `${keyToUpdate}=${newVersion}`;

      if (keyRegex.test(content)) {
        content = content.replace(keyRegex, newLine);
      } else {
        const prefix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
        content += `${prefix}${newLine}\n`;
      }

      fs.writeFileSync(filePath, content);
      console.log(`${GREEN}   ✔ Updated ${fileName}${RESET}`);
    } else {
      console.log(`${YELLOW}   ⚠  ${fileName} not found, skipping.${RESET}`);
    }
  });

  // 5. Update OpenAPI documentation version
  const openApiPath = path.join(process.cwd(), 'public', 'api-docs', 'openapi.yaml');
  
  if (fs.existsSync(openApiPath)) {
    let openApiContent = fs.readFileSync(openApiPath, 'utf8');
    
    // Update version in info section (YAML format: "  version: x.y.z")
    const versionRegex = /^(\s*version:\s*)\d+\.\d+\.\d+$/gm;
    openApiContent = openApiContent.replace(versionRegex, `$1${newVersion}`);
    
    fs.writeFileSync(openApiPath, openApiContent);
    console.log(`${GREEN}   ✔ Updated public/api-docs/openapi.yaml${RESET}`);
  } else {
    console.log(`${YELLOW}   ⚠  OpenAPI file not found, skipping.${RESET}`);
  }

  console.log(`\n${GREEN}✅ Successfully bumped all files to v${newVersion}.${RESET}\n`);

} catch (_err) {
  console.error(`\n${RED}❌ Script failed: ${_err.message}${RESET}`);
  process.exit(1);
}