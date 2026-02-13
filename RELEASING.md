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
   - Add `GPG_PASSPHRASE`: Create this secret with an empty string value (since the key was generated without a passphrase using `%no-protection`)
   
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

**NEW - Automated Version Bumping**: When a feature branch is merged to main, the CI/CD pipeline will automatically:

1. Detect if the branch name contains a version (e.g., in a version branch like `1.5.4`)
2. Run the version bump script to update package.json, lockfiles, and documentation
3. **Create a Pull Request** with the version changes
4. **Enable auto-merge** on the PR
5. **Wait for all required checks to pass**:
   - Required status checks (3 of 3)
   - CodeQL analysis
   - Test workflows
   - Commit signature verification
6. **Auto-merge the PR** when all checks pass
7. Create and push a git tag (e.g., `v1.5.5`)
8. Trigger the release workflow via the tag push
9. Build and publish the release

**How it works:**
- The workflow runs on every push to main branch
- The workflow creates a PR instead of pushing directly to main (respects branch protection)
- The PR is created by the GitHub App bot, which bypasses review requirements
- Auto-merge is enabled, so the PR merges automatically when all checks pass
- The commit message includes `[skip ci]` to prevent infinite workflow loops
- All commits and tags are GPG signed to satisfy signature requirements
- Version bump logic:
  - When `package.json` version = latest tag → Auto-increment patch
  - When `package.json` version > latest tag → Use package.json version (from release branch)
  - When no tags exist → Use package.json version

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

Each release includes:

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

**Platforms**: `linux/amd64`, `linux/arm64`

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
1. **[skip ci] not working**: Ensure the workflow has the condition `!contains(github.event.head_commit.message, '[skip ci]')`
2. **Branch name contains version**: The version bump script only runs on branches with semantic versions in the name

#### GPG signature verification failing

**Symptoms:** Commit signature shows as "Unverified" on GitHub.

**Possible causes:**
1. **Public key not added to GitHub**: Add the GPG public key to Settings → SSH and GPG keys
2. **Wrong email in GPG key**: Ensure the key uses `github-actions[bot]@users.noreply.github.com`
3. **GPG_PRIVATE_KEY secret malformed**: Ensure the entire key including headers is in the secret

#### Timeout waiting for PR merge

**Symptoms:** Workflow fails with "Timeout waiting for PR merge after 900s".

**Possible causes:**
1. **Tests taking too long**: Increase MAX_WAIT value in workflow (currently 15 minutes)
2. **Required checks not configured**: Ensure all required status checks are properly defined
3. **Manual review required**: Check if the GitHub App is in the bypass list for reviews

### General Issues

### Automatic version bump not working

**Check:**
- Verify the CI/CD pipeline runs successfully on main branch
- Check the `auto-version-and-tag` job logs in GitHub Actions
- Ensure git tags are properly formatted (v*.*.*) and can be fetched

**Common issues:**
- If no version bump occurs, check that the script can fetch git tags
- If version comparison fails, check that `package.json` has a valid semver version
- If commit fails, check that the workflow has `contents: write` permission

### Release workflow not triggered after tag push

**Check:**
- Verify `APP_ID` and `APP_PRIVATE_KEY` secrets are configured in repository settings
- Ensure the GitHub App has `Contents: Read and write` permissions
- Verify the tag was created and pushed successfully
- Check the Release workflow is enabled in Actions tab
- Look for the tag push event in the Actions tab

**Note**: The `auto-version-and-tag` job uses a GitHub App token to push tags. This is required because `GITHUB_TOKEN` cannot trigger other workflows (including the Release workflow) for security reasons. Tag push events created with a GitHub App token will properly trigger the release workflow.

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
