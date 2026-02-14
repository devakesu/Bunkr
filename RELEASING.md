# Release Process

This document describes how to create and verify releases for GhostClass.

## Table of Contents

- [Overview](#overview)
- [Semantic Versioning](#semantic-versioning)
- [Creating a Release](#creating-a-release)
  - [Automated Release (Manual Trigger)](#automated-release-manual-trigger)
  - [Tag-Based Release](#tag-based-release)
- [Release Artifacts](#release-artifacts)
- [Verifying Releases](#verifying-releases)
- [Release Checklist](#release-checklist)
- [Troubleshooting](#troubleshooting)

## Overview

GhostClass uses GitHub Actions to automate the release process, which includes:

- **Automatic Version Bumping**: Auto-increments patch version on pushes to `main` (including merges and direct commits)
- **Automatic Tagging**: Creates and pushes release tags based on `package.json` version
- **Semantic Versioning**: Following [semver](https://semver.org/) principles (MAJOR.MINOR.PATCH)
- **Multi-platform Docker images**: Built for `linux/amd64` and `linux/arm64`
- **Signed artifacts**: Using Sigstore cosign with keyless (OIDC) signing
- **Build attestations**: GitHub-native provenance attestations
- **SBOM (Software Bill of Materials)**: In CycloneDX JSON format
- **Checksum verification**: SHA256 checksums for all artifacts

## Semantic Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** version (x.0.0): Breaking changes or major new features
- **MINOR** version (0.x.0): New features, backward-compatible
- **PATCH** version (0.0.x): Bug fixes, backward-compatible

### Version Bumping Guidelines

- **Patch**: Bug fixes, security patches, minor documentation updates
- **Minor**: New features, enhancements, non-breaking API additions
- **Major**: Breaking changes, major refactors, incompatible API changes

**Documentation Changes:**
- **Trivial** (no release): Typo fixes, grammar corrections, formatting adjustments
- **Substantial** (patch bump): New feature documentation, API reference updates, significant structural changes, new guides

**Note**: Only substantial changes warrant version bumps.

## Creating a Release

### Prerequisites

Before the automated version bumping can trigger releases, ensure the following are configured:

#### 1. GitHub App for Automation

The auto-version workflow uses a GitHub App for authentication, which provides:
- More secure, scoped permissions compared to PATs
- Ability to be added to repository bypass lists
- Better audit trail (shows as "app-name[bot]")
- Tokens that auto-expire and refresh

**Create and configure the GitHub App:**

1. **Create a GitHub App**:
   - Go to Settings → Developer settings → GitHub Apps → New GitHub App
   - Name: `GhostClass Release Automation` (or similar)
   - Homepage URL: Your repository URL
   - Webhook: Uncheck "Active"
   - Repository permissions:
     - Contents: Read and write
     - Pull requests: Read and write
     - **Note**: Actions: Read and write is NOT required (uses `repository_dispatch` instead of `workflow_dispatch`)
   - Where can this be installed: "Only on this account"
   - Click "Create GitHub App"

2. **Install the App**:
   - Click "Install App" in left sidebar
   - Click "Install" next to your account
   - Select "Only select repositories" → Choose GhostClass
   - Click "Install"

3. **Generate Private Key**:
   - Go back to GitHub App settings
   - Scroll to "Private keys" section
   - Click "Generate a private key"
   - Save the downloaded `.pem` file securely

4. **Add secrets to repository**:
   - Go to repository → Settings → Secrets and variables → Actions
   - Add `APP_ID`: Your GitHub App's ID (found at top of app settings)
   - Add `APP_PRIVATE_KEY`: Full contents of the `.pem` file

5. **Add App to bypass list** (to bypass review requirements):
   - Go to Settings → Rules → Rulesets
   - Edit your main branch ruleset
   - Under "Bypass list", click "Add bypass"
   - Select your GitHub App: "GhostClass Release Automation"
   - Save changes

#### 2. GPG Key for Commit Signing

The workflow signs all commits and tags with GPG to satisfy signature requirements.

**Generate and configure GPG key:**

1. **Generate GPG key**:
   ```bash
   gpg --batch --gen-key <<EOF
   Key-Type: RSA
   Key-Length: 4096
   Name-Real: GitHub Actions Bot
   Name-Email: github-actions[bot]@users.noreply.github.com
   Expire-Date: 0
   %no-protection
   EOF
   ```

   > **Security note (non-expiring, unprotected key):**
   >
   > - `Expire-Date: 0` creates a non-expiring key. Combined with `%no-protection`, this is convenient for non-interactive automation but increases risk: if the repository (or its Actions secrets) is compromised and the `GPG_PRIVATE_KEY` secret is exfiltrated, an attacker can sign commits and tags as the automation bot indefinitely.
   > - This tradeoff is acceptable only if you treat the GPG private key as a highly sensitive secret, restrict access to repository settings, and are prepared to rotate and revoke the key quickly if compromise is suspected.
   >
   > **Recommended practices:**
   >
   > - **Key rotation:** Plan to rotate the GPG key on a regular schedule (e.g., every 12–24 months, or more frequently for high-security environments). Rotation means generating a new key, publishing the new public key, and updating the `GPG_PRIVATE_KEY` secret.
   > - **Revoke on compromise:** If you suspect that the key or repository secrets were compromised:
   >   1. Generate a revocation certificate for the compromised key and publish it to any keyservers or internal key distribution mechanisms you use.
   >   2. Remove the compromised GPG key from GitHub (Settings → SSH and GPG keys).
   >   3. Delete or immediately rotate any GitHub secrets that contained the old private key.
   >   4. Generate a new GPG key, add the new public key to GitHub, and update the `GPG_PRIVATE_KEY` secret.
   > - **Audit and alerts:** Monitor who can change repository secrets and branch protection rules, and enable alerts for unusual activity.
   >
   > **Alternative: use an expiring key**
   >
   > If you prefer not to use a non-expiring key, you can set an explicit expiration (e.g., 2 years) and document a rotation process:
   >
   > ```bash
   > gpg --batch --gen-key <<EOF
   > Key-Type: RSA
   > Key-Length: 4096
   > Name-Real: GitHub Actions Bot
   > Name-Email: github-actions[bot]@users.noreply.github.com
   > Expire-Date: 2y
   > %no-protection
   > EOF
   > ```
   >
   > With an expiring key, ensure you schedule key renewal before expiry, update the public key in GitHub, and rotate the `GPG_PRIVATE_KEY` secret to the new key.

2. **Export keys**:
   ```bash
   # List keys to get the key ID
   gpg --list-secret-keys --keyid-format=long
   
   # Export private key (replace KEY_ID)
   gpg --armor --export-secret-keys KEY_ID
   
   # Export public key
   gpg --armor --export KEY_ID
   ```

3. **Add to GitHub**:
   - Go to Settings → SSH and GPG keys → New GPG key
   - Paste the public key

4. **Add secrets to repository**:
   - Go to repository → Settings → Secrets and variables → Actions
   - Add `GPG_PRIVATE_KEY`: Full private key output including headers
   - Add `GPG_PASSPHRASE`: Either omit this secret entirely, or if your workflow expects it to exist, set it to a benign placeholder value (e.g., a single space character) since the key was generated without a passphrase using `%no-protection`
   
   **Note**: The key is generated without a passphrase for automated use in CI/CD. This is acceptable because:
   - The private key is stored securely in GitHub Secrets (encrypted at rest)
   - The key is only used within GitHub Actions runners (ephemeral environments)
   - Access is controlled by repository permissions
   - For additional security, the GitHub App authentication provides scoped access

#### 3. Enable Auto-merge

- Go to Settings → General → Pull Requests
- Check ✅ "Allow auto-merge"

You can create a release in several ways:

### Automatic Release (On Version Bump)

**Automated Version Bumping and Release**: When a branch is merged to main, the CI/CD pipeline will automatically:

1. Run the guard job (a prerequisite that checks out the repository to enable subsequent jobs)
2. Run the version bump script to compare package.json version with the latest git tag
3. Determine the new version (auto-increment patch, use package.json version, or no change)
4. **Two scenarios based on whether version files need updating:**

**Scenario A: Version already updated (branch name = `x.x.x`, e.g., `1.5.6`)**
- Version files are already correct in the merged PR
- Skip PR creation
- Create and push git tag immediately (e.g., `v1.5.6`)
- **Trigger the release workflow via workflow_dispatch** (explicit trigger to ensure it runs)
- **Release workflow builds, signs, and deploys** the Docker image with the correct version
  - Automated workflow_dispatch releases (with version_tag) auto-deploy to production

**Scenario B: Version needs updating (branch name ≠ `x.x.x`, e.g., `copilot/*`, `feature/*`)**
- **Create a Pull Request** with the version changes
- **Merge the PR immediately** (tests already passed on the previous PR)
  - Version bump PR only changes version numbers, not code logic
  - test.yml may still run on the version-bump PR, but the pipeline doesn't wait
  - Previous PR's tests are sufficient for validation
- Create and push a git tag (e.g., `v1.5.5`)
- **Trigger the release workflow via workflow_dispatch** (explicit trigger to ensure it runs)
- **Release workflow builds, signs, and deploys** the Docker image with the correct version
  - Automated workflow_dispatch releases (with version_tag) auto-deploy to production

**How it works:**
- The pipeline workflow runs on every push to main branch
- The pipeline workflow manages versioning (no Docker builds); code validation is handled by required checks (e.g., `test.yml`, CodeQL)
- The pipeline creates a PR when version files need updating (respects branch protection)
- The PR is created by the GitHub App bot, which bypasses review requirements
- **The version bump PR is merged immediately without waiting for tests** (tests already passed on the previous PR)
- The commit message includes `[skip ci]` to prevent infinite workflow loops
- All commits and tags are GPG signed to satisfy signature requirements
- Version bump logic:
  - When `package.json` version = latest tag → Auto-increment patch
  - When `package.json` version > latest tag → Use package.json version (from release branch)
  - When no tags exist → Use package.json version
- **After creating the tag, the release workflow is explicitly triggered via workflow_dispatch**
- The release workflow builds multi-platform images, signs them, and deploys to Coolify

**Key Benefit**: This architecture ensures only one Docker build per release, with the correct version number matching the git tag and deployed to production.

**Note**: The version bump script detects the branch context. On main branch (CI environment), it always runs version comparison logic. On local branches, it only runs if the branch name matches the pattern X.Y.Z (semantic version).

### Version Branches (Minor/Major Versions)

For controlled version bumps (minor or major versions), use version branches:

```bash
# Create a version branch (format: X.Y.Z)
git checkout -b 1.6.0

# Run the version bump script
npm run bump-version

# The script will:
# - Extract version (1.6.0) from branch name
# - Update package.json, package-lock.json
# - Update .env, .example.env (NEXT_PUBLIC_APP_VERSION)
# - Update public/api-docs/openapi.yaml

# Review changes
git diff

# Commit and create PR to main
git add .
git commit -m "chore: bump version to v1.6.0"
git push origin 1.6.0
```

When the version branch is merged to main:
1. CI detects `package.json` version (1.6.0) > latest tag (e.g., 1.5.5)
2. Uses the version from `package.json` (no auto-increment)
3. Updates remaining files if needed
4. Creates tag `v1.6.0`
5. Triggers release workflow

**Branch naming convention**: `X.Y.Z` (e.g., `1.6.0`, `2.0.0`)

**Note**: For feature branches or direct PRs (e.g., `copilot/feature`), the CI will automatically increment the patch version.

### Manual Release (Workflow Dispatch)

**Note**: This method is generally not needed with automated version bumping. Use release branches for controlled version bumps instead.

1. Go to **Actions** → **Release** workflow in GitHub
2. Click **Run workflow**
3. Select the version bump type (patch/minor/major)
4. Click **Run workflow**

The workflow will:
- Calculate the next version based on the latest tag
- Build multi-platform Docker images
- Sign images and artifacts
- Generate SBOM and attestations
- Create a GitHub Release with all artifacts

**Example:**
- Latest tag: `v1.2.3`
- Bump type: `minor`
- New version: `v1.3.0`

### Tag-Based Release

**Note**: This method is generally not needed with automated version bumping. Tags are automatically created by the CI/CD pipeline.

1. Create and push a version tag:
   ```bash
   git tag v1.3.0
   git push origin v1.3.0
   ```

2. The release workflow will automatically trigger and use the tag version.

**Note**: Tags must follow the pattern `v*.*.*` (e.g., `v1.0.0`, `v2.1.5`)

## Release Artifacts

The release workflow can be triggered either by pushing a version tag or manually via `workflow_dispatch`:

- **Tag-push releases (auto-deploy)**: When a matching version tag is pushed, the workflow builds release artifacts and automatically deploys the new version.
- **Manually dispatched releases (no auto-deploy)**: When the workflow is run manually, it builds and publishes release artifacts, but deployment is not performed automatically.

For tag-push releases (auto-deploy), the workflow performs the following steps:

1. **Docker Image Build**: Multi-platform images built for `linux/amd64` and `linux/arm64`
2. **Image Signing**: Images are signed with Sigstore cosign
3. **Attestations**: Build provenance and SBOM attestations are generated
4. **GitHub Release**: Release is created with all artifacts attached
5. **Deployment**: The versioned image is automatically deployed to Coolify

### Docker Images

Images are pushed to GitHub Container Registry (GHCR) with multiple tags:

**Format:** `ghcr.io/{OWNER}/{REPO}:{TAG}`

```bash
# Pull by version tag (example)
docker pull ghcr.io/devakesu/ghostclass:v1.3.0

# Pull by version without 'v' prefix
docker pull ghcr.io/devakesu/ghostclass:1.3.0

# Pull latest (only updated for manual dispatch releases)
docker pull ghcr.io/devakesu/ghostclass:latest
```

**Note**: Replace `devakesu/ghostclass` with your `{OWNER}/{REPO}` (repository name in lowercase).

**Available Tags**:
- **Version tags** (e.g., `v1.3.0`, `1.3.0`): Produced by the release workflow for each tagged release
- **`latest`**: Only updated for manual workflow_dispatch releases

**Tags No Longer Produced**:
- `main`: Previously built by pipeline.yml on every push to main (removed to eliminate duplicate builds)
- `{sha}`: Previously built by pipeline.yml with commit SHA (removed to eliminate duplicate builds)

If you have systems or documentation that depend on `:main` or commit-SHA tags, update them to use version tags instead.

**Platforms**: `linux/amd64`, `linux/arm64` (for tag pushes); `linux/amd64` only for manual dispatch unless ARM64 is explicitly enabled

**Deployment**: For tag-based releases (tag pushes), the versioned image (e.g., `v1.3.0`) is automatically deployed to production via Coolify after the GitHub release is successfully created. Manually dispatched releases do not trigger automatic deployment and must be deployed separately if needed.

**Note**: Ensure your Coolify application is configured to pull images using the version tag format (e.g., `ghcr.io/devakesu/ghostclass:v1.3.0`) so deployments use the correct versioned image.

### Attached Files

Each GitHub Release includes:

- **sbom.json**: Software Bill of Materials (CycloneDX format)
- **sbom.json.bundle**: Cosign signature bundle for SBOM
- **checksums.txt**: SHA256 checksums for all artifacts
- **VERIFY.md**: Detailed verification instructions

## Verifying Releases

### Prerequisites

Install the required tools:

```bash
# Install cosign
brew install sigstore/tap/cosign  # macOS
# OR
go install github.com/sigstore/cosign/v2/cmd/cosign@latest

# Install GitHub CLI
brew install gh  # macOS
# OR see https://cli.github.com/
```

### Verify Docker Image Signature

Using cosign with keyless verification (OIDC):

**Note**: Replace `{VERSION}` with your target release version (e.g., `v1.3.0`), `{OWNER}` with the repository owner, and `{REPO}` with the repository name (lowercase).

```bash
cosign verify \
  --certificate-identity-regexp="^https://github.com/{OWNER}/{REPO}" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/{OWNER}/{REPO}:{VERSION}
```

**Example for this repository:**
```bash
cosign verify \
  --certificate-identity-regexp="^https://github.com/devakesu/GhostClass" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/devakesu/ghostclass:v1.3.0
```

**Expected output**: Verification success with certificate details and signature metadata.

### Verify Build Attestation

Using GitHub CLI:

```bash
gh attestation verify oci://ghcr.io/{OWNER}/{REPO}:{VERSION} --owner {OWNER}
```

**Example for this repository:**
```bash
gh attestation verify oci://ghcr.io/devakesu/ghostclass:v1.3.0 --owner devakesu
```

**Expected output**: Attestation verification success with build provenance details.

### Verify SBOM Signature

Download the SBOM and signature bundle from the release, then verify:

```bash
cosign verify-blob \
  --bundle sbom.json.bundle \
  sbom.json
```

### Verify Checksums

Download artifacts and verify their checksums:

**Note**: Replace `{OWNER}`, `{REPO}`, and `{VERSION}` with your values.

```bash
# Download the checksums file and artifacts to the same directory
wget https://github.com/{OWNER}/{REPO}/releases/download/{VERSION}/checksums.txt
wget https://github.com/{OWNER}/{REPO}/releases/download/{VERSION}/sbom.json
wget https://github.com/{OWNER}/{REPO}/releases/download/{VERSION}/sbom.json.bundle

# Verify checksums (extract only valid checksum lines)
grep -E '^[0-9a-f]{64}  ' checksums.txt | sha256sum -c

# Or verify individual files manually
sha256sum sbom.json sbom.json.bundle
```

**Example for this repository:**
```bash
wget https://github.com/devakesu/GhostClass/releases/download/v1.3.0/checksums.txt
wget https://github.com/devakesu/GhostClass/releases/download/v1.3.0/sbom.json
wget https://github.com/devakesu/GhostClass/releases/download/v1.3.0/sbom.json.bundle
grep -E '^[0-9a-f]{64}  ' checksums.txt | sha256sum -c
```

**Note**: All artifact files must be in the same directory as `checksums.txt` for verification to work.

### Complete Verification Example

**Note**: Replace values with your repository details. Example below uses `devakesu/GhostClass` and `v1.3.0`.

```bash
# 1. Verify image signature
cosign verify \
  --certificate-identity-regexp="^https://github.com/devakesu/GhostClass" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/devakesu/ghostclass:v1.3.0

# 2. Verify attestation
gh attestation verify oci://ghcr.io/devakesu/ghostclass:v1.3.0 --owner devakesu

# 3. Download and verify SBOM
wget https://github.com/devakesu/GhostClass/releases/download/v1.3.0/sbom.json
wget https://github.com/devakesu/GhostClass/releases/download/v1.3.0/sbom.json.bundle
cosign verify-blob --bundle sbom.json.bundle sbom.json

# 4. Verify checksums
wget https://github.com/devakesu/GhostClass/releases/download/v1.3.0/checksums.txt
grep -E '^[0-9a-f]{64}  ' checksums.txt | sha256sum -c
```

## Release Checklist

Before creating a release:

- [ ] All tests pass (`npm run test`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Documentation is up to date
- [ ] CHANGELOG is updated (if applicable)
- [ ] Security vulnerabilities are addressed
- [ ] Breaking changes are documented (for major versions)

After creating a release:

- [ ] Verify GitHub Release was created successfully
- [ ] Verify Docker images are available in GHCR
- [ ] Verify image signatures with cosign
- [ ] Verify build attestations
- [ ] Test pulling and running the released image
- [ ] Check OpenSSF Scorecard for "Signed-Releases" passing
- [ ] Update deployment environments (staging, production)
- [ ] Announce the release (if needed)

## Troubleshooting

### Release Not Created After Tag Push

**Symptom:** Tag `v1.5.8` exists but no release on GitHub

**Cause:** Tags pushed from workflows don't auto-trigger other workflows (GitHub Actions security feature to prevent recursive triggers)

**Fix:** The pipeline now automatically triggers the release workflow after creating the tag using `workflow_dispatch`. 
If it fails, manually trigger:

```bash
gh workflow run release.yml --ref v1.5.8 -f version_tag=v1.5.8
```

### Tag Created Despite Failed Tests

**Symptom:** Tag created but tests were failing

**Cause:** This could happen if:
1. Tests failed on the original PR but branch protection was bypassed
2. Tests passed initially but code was broken by a race condition

**Prevention:** The auto-version-and-tag job that creates release tags only runs on pushes to `main`, meaning the previous PR's tests must have passed for the merge to occur (assuming branch protection is properly configured), while the rest of the pipeline workflow can still run on PR-related events.

**Fix:** If a tag was created incorrectly:

```bash
# Delete the bad tag
git tag -d v1.5.8
git push --delete origin v1.5.8

# Fix the issue, then manually create tag after tests pass
```

**Best Practice:** Ensure branch protection rules require:
- All required status checks to pass
- Up-to-date branches before merging

### Auto-Version Workflow Issues

#### PR not auto-merging

**Symptoms:** Version bump PR is created but doesn't merge automatically.

**Possible causes:**
1. **Auto-merge not enabled**: Go to Settings → General → Pull Requests → Enable "Allow auto-merge"
2. **Required checks failing**: Check the PR for failed status checks, tests, or CodeQL issues
3. **GitHub App not in bypass list**: Go to Settings → Rules → Rulesets → Add app to bypass list
4. **Commit signature verification failing**: Ensure GPG_PRIVATE_KEY secret is configured correctly

#### Infinite loop / Multiple version bump PRs

**Symptoms:** Workflow keeps creating new version bump PRs.

**Possible causes:**
1. **Actor check not configured**: Ensure the workflow has the condition `github.actor != 'github-actions[bot]'` to skip runs triggered by the automation bot itself
2. **[skip ci] not in commit message**: Verify the commit message (not title) includes `[skip ci]` marker which is preserved during squash merge to prevent re-triggering workflows
3. **Concurrent workflows**: Multiple commits to main in rapid succession can trigger parallel workflows before the first PR is merged

#### GPG signature verification failing

**Symptoms:** Commit signature shows as "Unverified" on GitHub.

**Possible causes:**
1. **Public key not added to GitHub**: Add the GPG public key to Settings → SSH and GPG keys
2. **Wrong email in GPG key**: Ensure the key uses `github-actions[bot]@users.noreply.github.com`
3. **GPG_PRIVATE_KEY secret malformed**: Ensure the entire key including headers is in the secret

#### Timeout waiting for PR merge

**Symptoms:** Workflow fails with "Failed to merge PR" or timeout error.

**Possible causes:**
1. **GitHub API slow to process PR**: Rare, but GitHub might be experiencing delays
2. **Branch protection rules**: Ensure the GitHub App is in the bypass list
3. **GitHub App permissions**: Verify the app has merge permissions

**Fix:** If the workflow times out, you can manually create the tag:

```bash
# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Create and push the tag
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin "v${VERSION}"
```

**Note:** The timeout is 5 minutes for PR creation and merge completion.

#### Release not created after merging version bump PR

**Symptom**: You merged a PR with version updates (e.g., PR #358 with branch `1.5.6`), but no release was created.

**Cause**: This was a bug in workflow versions prior to the fix in this PR. The workflow would skip tag creation when version files were already updated in the merged PR (when branch name matched `x.x.x` format).

**Solution**: 
- If using old workflow: Manually create and push tag:
  ```bash
  git checkout main
  git pull origin main
  VERSION=$(node -p "require('./package.json').version")
  git tag -a "v${VERSION}" -m "Release v${VERSION}"
  git push origin "v${VERSION}"
  ```
- Update to latest workflow version which fixes this issue
- The fixed workflow creates tags immediately for PRs from version branches (no PR needed)

### General Issues

### Automatic version bump not working

**Check:**
- Verify the CI/CD pipeline runs successfully on main branch
- Check the `auto-version-and-tag` job logs in GitHub Actions
- Ensure git tags are properly formatted (v*.*.*) and can be fetched
- Verify the "Trigger release workflow" step completed successfully

**Common issues:**
- If no version bump occurs, check that the script can fetch git tags
- If version comparison fails, check that `package.json` has a valid semver version
- If commit fails, check that the workflow has `contents: write` permission
- If release workflow doesn't trigger, check the "Trigger release workflow" step logs for errors

**Note on workflow triggering:**
- The pipeline uses `repository_dispatch` events to trigger the release workflow
- This approach only requires `Contents: Read and write` permission on the GitHub App
- If you see HTTP 403 errors related to workflow_dispatch, verify the pipeline is using repository_dispatch (not workflow_dispatch)

### Release workflow not triggered after tag push

**Check:**
- Verify `APP_ID` and `APP_PRIVATE_KEY` secrets are configured in repository settings
- Ensure the GitHub App has `Contents: Read and write` permissions
- Verify the tag was created and pushed successfully
- Check the Release workflow is enabled in Actions tab
- Look for the workflow runs in the Actions tab:
  - For automated releases from pipeline: Look for `repository_dispatch` runs (event type: `release_requested`)
  - For manual tag pushes: Look for push (tag) events
  - For manual workflow_dispatch: Look for workflow_dispatch runs

**Note**: The `auto-version-and-tag` job uses a GitHub App token to push tags and then explicitly triggers the release workflow via `repository_dispatch`. This approach:
- Only requires `Contents: Read and write` permission (no `Actions: Read and write` needed)
- Works reliably because tag push events from within a workflow don't automatically trigger other workflows (GitHub Actions security feature)
- Uses the `/dispatches` API endpoint instead of `workflow_dispatch` to avoid HTTP 403 permission errors

### HTTP 403: Resource not accessible by integration

**Symptoms:** Pipeline fails with error:
```
could not create workflow dispatch event: HTTP 403: Resource not accessible by integration
```

**Cause:** This error occurred in older versions of the workflow when trying to use `workflow_dispatch` without the `Actions: Read and write` permission on the GitHub App.

**Solution:** The workflows have been updated to use `repository_dispatch` instead of `workflow_dispatch`, which only requires `Contents: Read and write` permission. This error should no longer occur with the updated workflows.

If you still see this error:

1. **Verify the pipeline is up to date:**
   - Check that `.github/workflows/pipeline.yml` uses `gh api repos/${{ github.repository }}/dispatches` with `event_type="release_requested"`
   - The step should be named "Trigger release workflow via repository_dispatch"

2. **Verify the release workflow accepts repository_dispatch:**
   - Check that `.github/workflows/release.yml` has `repository_dispatch:` with `types: [release_requested]` in the trigger section
   - The `calculate-version` job should handle `github.event.client_payload.version_tag`

3. **If you still want to use workflow_dispatch (optional):**
   - Go to GitHub App settings: Settings → Developer settings → GitHub Apps → [Your App]
   - Navigate to "Permissions & events" → "Repository permissions"
   - Set **Actions** to **Read and write**
   - Save and re-install the app if needed
   - Update `pipeline.yml` to add `actions: write` to the job permissions
   - Revert the pipeline to use `gh workflow run` instead of `gh api repos/.../dispatches`

**Recommended:** Keep using `repository_dispatch` as it requires fewer permissions and is more secure.

### Deployment not happening after release

**Symptoms:** Release is created successfully but deployment to Coolify doesn't occur.

**Check:**
- Verify the release workflow completed successfully (check GitHub Actions logs)
- Check that `COOLIFY_BASE_URL`, `COOLIFY_APP_ID`, and `COOLIFY_API_TOKEN` secrets are configured
- Verify the deployment step in the release workflow's `deploy-to-production` job executed
- Check Coolify logs to see if the deployment webhook was received
- Verify the trigger type:
  - **Automated releases**: repository_dispatch with version_tag → auto-deploys
  - **Manual workflow_dispatch**: with bump_type only (no version_tag) → does NOT auto-deploy
  - **Manual tag push**: by developer → auto-deploys

**Note**: The deploy-to-production job runs when:
1. A tag is pushed directly (e.g., by a developer), OR
2. The release workflow is triggered via repository_dispatch with a version_tag parameter (automated releases from pipeline), OR
3. The release workflow is triggered via workflow_dispatch with a version_tag parameter

Manual workflow_dispatch releases using bump_type only (without version_tag) do not auto-deploy and must be deployed separately if needed.

### Wrong version deployed to production

**Symptoms:** Production is running a different version than the latest release tag.

**Cause**: This should no longer occur with the updated workflow architecture. The release workflow now builds and deploys the correct versioned image.

**Solution**: 
- Verify the release workflow completed successfully
- Check that Coolify is pulling the correct image tag (should be the version tag, e.g., `v1.5.8`)
- If needed, manually trigger a Coolify deployment to pull the latest release

### Version bump script fails on version branch

**Check:**
- Verify branch name follows the pattern `X.Y.Z` (e.g., `1.6.0`)
- Ensure the version in the branch name is a valid semver (digits only, no `v` prefix)
- Check that all version files exist and are writable

### Release workflow fails during build

**Check:**
- All required secrets are configured in GitHub repository settings
- Build secrets haven't expired (e.g., `SENTRY_AUTH_TOKEN`)
- Dockerfile builds successfully locally

### Image signature verification fails

**Check:**
- You're using the correct certificate identity regex
- The image digest matches (use `@sha256:...` format)
- Cosign is up to date (`cosign version`)

### Attestation verification fails

**Check:**
- GitHub CLI is authenticated (`gh auth status`)
- You're using the correct repository owner
- The attestation was pushed to the registry

### Tag already exists

If you need to re-release a version:

1. Delete the tag locally and remotely:
   ```bash
   git tag -d v1.3.0
   git push origin :refs/tags/v1.3.0
   ```

2. Delete the GitHub Release (via GitHub UI)

3. Create the tag again and push

### Multi-platform build takes too long

The release workflow builds for both `linux/amd64` and `linux/arm64`, which can take 15-30 minutes. This is expected behavior.

To build only for one platform during testing:
1. Modify the workflow temporarily
2. Change `platforms: linux/amd64,linux/arm64` to `platforms: linux/amd64`
3. Revert before merging

## Additional Resources

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Sigstore Cosign Documentation](https://docs.sigstore.dev/cosign/overview/)
- [GitHub Attestations Documentation](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
- [SBOM Overview (CISA)](https://www.cisa.gov/sbom)
- [OpenSSF Scorecard](https://securityscorecards.dev/)
- [CycloneDX SBOM Standard](https://cyclonedx.org/)

---

For questions or issues with the release process, please open an issue in the repository.
