 
 

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

try {
  console.log(`${YELLOW}🚀 Starting Auto-Version Bump...${RESET}`);

  // 1. Get current branch name
  let branchName = 'unknown';
  try {
    branchName = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (e) {
    console.error(`${RED}❌ Failed to get git branch. Are you in a git repo?${RESET}`);
    process.exit(1);
  }

  // 2. Extract version from branch (e.g., "release/1.2.0" -> "1.2.0")
  const versionRegex = /(\d+\.\d+\.\d+)/;
  const match = branchName.match(versionRegex);

  if (!match) {
    console.log(`${YELLOW}ℹ️  Branch '${branchName}' does not contain a semantic version (x.y.z).`);
    console.log(`   Skipping version bump.${RESET}\n`);
    process.exit(0);
  }

  const newVersion = match[1];
  console.log(`   🎯 Detected Target Version: ${GREEN}${newVersion}${RESET} (from branch '${branchName}')`);

  // 3. Update package.json & package-lock.json
  try {
    execSync(`npm version ${newVersion} --no-git-tag-version --allow-same-version`, { stdio: 'ignore' });
    console.log(`${GREEN}   ✔ Updated package.json & package-lock.json${RESET}`);
  } catch (e) {
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
      const keyRegex = new RegExp(`^${keyToUpdate}=.*$`, 'm');
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

  console.log(`\n${GREEN}✅ Successfully bumped all files to v${newVersion}.${RESET}\n`);

} catch (e) {
  console.error(`\n${RED}❌ Script failed: ${e.message}${RESET}`);
  process.exit(1);
}