# Cosign Signature Verification Guide

This document explains how to verify Docker image signatures created by the CI/CD pipeline using Sigstore Cosign.

## Understanding Keyless Signing

Our pipeline uses **keyless signing** with Sigstore Cosign, which means:
- No private keys to manage or secure
- Signatures are linked to GitHub Actions OIDC tokens
- Certificate identity reflects the exact workflow that signed the image

## Certificate Identity Format

When GitHub Actions signs an image, the certificate identity follows this format:
```
https://github.com/{OWNER}/{REPO}/.github/workflows/{WORKFLOW}.yml@refs/heads/{BRANCH}
```

For our main branch pipeline:
```
https://github.com/devakesu/GhostClass/.github/workflows/pipeline.yml@refs/heads/main
```

For releases:
```
https://github.com/devakesu/GhostClass/.github/workflows/release.yml@refs/tags/{VERSION}
```

## Verification Methods

### Method 1: Regex Pattern (Recommended for Automation)

This method is flexible and works across different workflows and tags:

```bash
cosign verify \
  --certificate-identity-regexp="^https://github.com/devakesu/GhostClass/.github/workflows/" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/devakesu/ghostclass:main
```

**Advantages:**
- Works for both `pipeline.yml` and `release.yml`
- Works for all branches and tags
- Simpler to maintain

### Method 2: Exact Identity Match (Strict Verification)

For maximum security when you know the exact workflow:

```bash
# For main branch (pipeline.yml)
cosign verify \
  --certificate-identity="https://github.com/devakesu/GhostClass/.github/workflows/pipeline.yml@refs/heads/main" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/devakesu/ghostclass:main

# For releases (release.yml)
cosign verify \
  --certificate-identity="https://github.com/devakesu/GhostClass/.github/workflows/release.yml@refs/tags/v1.3.0" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/devakesu/ghostclass:v1.3.0
```

**Advantages:**
- Most restrictive
- Ensures signature came from specific workflow and branch

**Disadvantages:**
- Must update for different workflows or branches
- Harder to automate

## Deployment System Integration

### Coolify Health Check Script

Use this script for Coolify's "Execute Command Before Deployment" or health check:

```bash
#!/bin/bash
set -euo pipefail

# Variables
IMAGE="ghcr.io/devakesu/ghostclass:main"
REPO_PATTERN="^https://github.com/devakesu/GhostClass/.github/workflows/"
OIDC_ISSUER="https://token.actions.githubusercontent.com"

echo "=== Verifying Image Signature ==="

# Download and verify cosign binary
if [ ! -f "/tmp/cosign" ]; then
  COSIGN_VERSION="v2.2.4"
  COSIGN_URL="https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64"
  COSIGN_CHECKSUM_URL="https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign_checksums.txt"
  
  echo "Downloading cosign ${COSIGN_VERSION}..."
  wget -qO /tmp/cosign "${COSIGN_URL}"
  
  echo "Downloading and verifying checksum..."
  wget -qO /tmp/cosign_checksums.txt "${COSIGN_CHECKSUM_URL}"
  
  # Extract the expected checksum for cosign-linux-amd64
  EXPECTED_CHECKSUM=$(grep "cosign-linux-amd64$" /tmp/cosign_checksums.txt | awk '{print $1}')
  
  if [ -z "${EXPECTED_CHECKSUM}" ]; then
    echo "ERROR: Could not find checksum for cosign-linux-amd64 in checksums file"
    exit 1
  fi
  
  # Calculate actual checksum of downloaded binary
  ACTUAL_CHECKSUM=$(sha256sum /tmp/cosign | awk '{print $1}')
  
  # Verify checksums match
  if [ "${ACTUAL_CHECKSUM}" != "${EXPECTED_CHECKSUM}" ]; then
    echo "ERROR: Checksum verification failed!"
    echo "Expected: ${EXPECTED_CHECKSUM}"
    echo "Actual:   ${ACTUAL_CHECKSUM}"
    exit 1
  fi
  
  echo "✓ Checksum verified successfully"
  chmod +x /tmp/cosign
fi

# Verify image signature with retry logic
MAX_ATTEMPTS=3
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  echo "Verification attempt $ATTEMPT of $MAX_ATTEMPTS..."
  
  if /tmp/cosign verify \
    --certificate-identity-regexp="$REPO_PATTERN" \
    --certificate-oidc-issuer="$OIDC_ISSUER" \
    "$IMAGE" 2>&1; then
    echo "✓ Image signature verified successfully"
    break
  else
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
      echo "ERROR: Image signature verification failed after $MAX_ATTEMPTS attempts"
      echo "This may indicate:"
      echo "1. Image was built before signing was implemented"
      echo "2. Signing step failed in CI/CD pipeline"
      echo "3. Signature hasn't propagated yet (wait 1-2 minutes)"
      exit 1
    fi
    
    echo "⚠ Verification failed, retrying in 30 seconds..."
    sleep 30
    ATTEMPT=$((ATTEMPT + 1))
  fi
done

# Verify attestation
echo "=== Verifying Build Attestation ==="
if /tmp/cosign verify-attestation \
  --type cyclonedx \
  --certificate-identity-regexp="$REPO_PATTERN" \
  --certificate-oidc-issuer="$OIDC_ISSUER" \
  "$IMAGE" 2>&1; then
  echo "✓ Attestation verified successfully"
else
  echo "⚠ Attestation verification failed (non-critical)"
fi

echo "✓ All verifications passed"
```

**One-liner version for Coolify:**

```bash
wget -qO /tmp/cosign https://github.com/sigstore/cosign/releases/download/v2.2.4/cosign-linux-amd64 && chmod +x /tmp/cosign && /tmp/cosign verify --certificate-identity-regexp="^https://github.com/devakesu/GhostClass/.github/workflows/" --certificate-oidc-issuer https://token.actions.githubusercontent.com ghcr.io/devakesu/ghostclass:main
```

**Important:** If verification fails on first deployment after enabling signing:
1. Wait 2-3 minutes for signature propagation
2. Check GitHub Actions workflow logs for signing step status
3. Verify the signing step completed successfully

### Docker Compose / Kubernetes

Add an init container or pre-deployment job:

```yaml
# Example init container for Kubernetes
initContainers:
  - name: verify-signature
    image: gcr.io/projectsigstore/cosign:v2.2.4
    command:
      - sh
      - -c
      - |
        cosign verify \
          --certificate-identity-regexp="^https://github.com/devakesu/GhostClass/.github/workflows/" \
          --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
          ghcr.io/devakesu/ghostclass:main
```

## Troubleshooting

### Error: "no signatures found"

**Possible causes:**
1. Image was built before signing was implemented
2. Signing step failed in CI/CD pipeline
3. Using wrong certificate identity or OIDC issuer
4. Image digest doesn't match (use `@sha256:...` instead of tags when possible)

**Solutions:**
```bash
# Check if signature exists
cosign tree ghcr.io/devakesu/ghostclass:main

# Verify with more verbose output
cosign verify \
  --certificate-identity-regexp="^https://github.com/devakesu/GhostClass" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/devakesu/ghostclass:main \
  --verbose
```

### Error: "certificate identity mismatch"

Your certificate identity doesn't match what was used during signing.

**Solution:** Use regex pattern instead of exact match:
```bash
# ❌ Too specific
--certificate-identity="https://github.com/devakesu/GhostClass"

# ✅ Flexible regex
--certificate-identity-regexp="^https://github.com/devakesu/GhostClass/.github/workflows/"
```

### Verifying Specific Image Digest

For maximum security, verify using the image digest instead of tags:

```bash
# Get the digest
docker pull ghcr.io/devakesu/ghostclass:main
docker inspect --format='{{index .RepoDigests 0}}' ghcr.io/devakesu/ghostclass:main

# Verify the digest
cosign verify \
  --certificate-identity-regexp="^https://github.com/devakesu/GhostClass/.github/workflows/" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/devakesu/ghostclass@sha256:abc123...
```

## Reference

- [Sigstore Cosign Documentation](https://docs.sigstore.dev/cosign/overview/)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Keyless Signing Explained](https://docs.sigstore.dev/cosign/keyless/)
