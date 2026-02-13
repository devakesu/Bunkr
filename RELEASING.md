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

- **Automatic Tagging**: Detects version changes in `package.json` and auto-creates release tags
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

There are three ways to create a release:

### Prerequisites

Before using the auto-tag-release feature, ensure the `RELEASE_TOKEN` secret is configured:

1. **Create a Fine-Grained Personal Access Token**:
   - Go to https://github.com/settings/tokens?type=beta
   - Click "Generate new token"
   - Token name: `GhostClass Release Automation` (or similar)
   - Expiration: Choose appropriate expiration (recommend 1 year)
   - Repository access: "Only select repositories" → Select your repository
   - Permissions:
     - Repository permissions → **Contents: Read and write**
   - Click "Generate token" and copy the token value

2. **Add the token as a repository secret**:
   - Go to your repository's Settings > Secrets and variables > Actions
   - Click "New repository secret"
   - Name: `RELEASE_TOKEN`
   - Secret: Paste the PAT value
   - Click "Add secret"

**Note**: The `RELEASE_TOKEN` is required for the auto-tag-release workflow to trigger the Release workflow. Without it, version tags will be created but releases won't be automatically published.

### Automatic Release (On Version Bump)

**NEW**: When you update the version in `package.json` and push to the main branch, the CI/CD pipeline will automatically:

1. Detect the version change (compares to previous commit)
2. Create and push a git tag (e.g., `v1.5.4`)
3. Trigger the release workflow via the tag push
4. Build and publish the release

**How to use:**
```bash
# Update version in package.json and lockfile(s)
npm version patch  # or minor, or major

# Commit and push to main
git add package.json package-lock.json  # include other lockfiles if present (e.g., yarn.lock, pnpm-lock.yaml)
git commit -m "chore: bump version to v1.5.4"
git push origin main
```

The `auto-tag-release` job in the pipeline will:
- Verify that the version in `package.json` actually changed in your push
- Create the tag only if it doesn't already exist
- Push the tag, which automatically triggers the release workflow

**Note**: The job only creates tags when the version is actually changed in the push, preventing unnecessary tags on re-runs or merges where the version hasn't changed.

### Manual Release (Workflow Dispatch)

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

### Release workflow not triggered after tag push

**Check:**
- Verify `RELEASE_TOKEN` secret is configured in repository settings
- Ensure the token has `Contents: Read and write` permissions
- Check that the token hasn't expired
- Verify the token is added to the correct repository

If the tag was created but release workflow didn't trigger:
1. The tag was likely pushed using `GITHUB_TOKEN` instead of `RELEASE_TOKEN`
2. GitHub Actions workflows cannot trigger other workflows when using `GITHUB_TOKEN`
3. Solution: Reconfigure `RELEASE_TOKEN` and re-push the tag (see Prerequisites section)

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
