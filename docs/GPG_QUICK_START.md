# Quick Start: GPG Key Setup

This is a quick reference for setting up GPG signing. For detailed instructions, see [GPG_SETUP.md](./GPG_SETUP.md).

## ⚠️ Important: Use RSA Keys

**Use RSA 4096-bit keys, NOT ECC Curve 25519!**

ECC keys can cause "Inappropriate ioctl for device" errors in GitHub Actions. RSA keys are more compatible with automated CI/CD environments.

## TL;DR - Quick Setup

### 1. Generate GPG Key
```bash
gpg --full-generate-key
```
- Choose **RSA and RSA**, 4096 bits ⚠️ **NOT ECC/EdDSA**
- Use email: `61821107+devakesu@users.noreply.github.com` (your GitHub no-reply email)
- Set a strong passphrase

### 2. Export Keys
```bash
# Get your key ID
gpg --list-secret-keys --keyid-format=long

# Export private key (save this for repository secrets)
gpg --armor --export-secret-keys YOUR_KEY_ID

# Export public key (add this to GitHub)
gpg --armor --export YOUR_KEY_ID
```

### 3. Add to GitHub
1. **Add public key**: GitHub → Settings → SSH and GPG keys → New GPG key
2. **Verify email**: GitHub → Settings → Emails (your no-reply email should already be verified)

### 4. Add to Repository Secrets
Go to repository Settings → Secrets and variables → Actions, add:

| Secret Name | Value |
|------------|-------|
| `GPG_PRIVATE_KEY` | Output from `gpg --armor --export-secret-keys` |
| `GPG_PASSPHRASE` | The passphrase you set |

**Optional** (to override defaults):
| Secret Name | Value |
|------------|-------|
| `GPG_COMMITTER_NAME` | Your preferred name (default: "GhostClass Bot") |
| `GPG_COMMITTER_EMAIL` | Your email (default: "61821107+devakesu@users.noreply.github.com") |

### 5. Test
Create a test PR and check that the auto-version-bump commit shows as "Verified" ✅

## Default Configuration

If you don't set the optional secrets, the workflow will use:
- **Name**: GhostClass Bot
- **Email**: 61821107+devakesu@users.noreply.github.com

This email is your GitHub no-reply address and is automatically verified!

## Using a Different Email

If you want to use a different email:
1. Make sure it's verified in GitHub Settings → Emails
2. Generate GPG key with that email
3. Add `GPG_COMMITTER_EMAIL` secret with that email

## Troubleshooting

**Problem**: Commits still show as "Unverified"
- ✅ Check: Email in GPG key matches `GPG_COMMITTER_EMAIL` or default
- ✅ Check: Email is verified in GitHub Settings → Emails
- ✅ Check: Public GPG key is added to GitHub account

**Problem**: Workflow fails with "Bad passphrase"
- ✅ Check: `GPG_PASSPHRASE` secret matches the passphrase you set

**Problem**: "No secret key" error
- ✅ Check: You exported the PRIVATE key (not just public)
- ✅ Check: You copied the entire key including headers/footers

**Problem**: "Inappropriate ioctl for device" error
- ✅ **Solution**: Generate a new RSA 4096-bit key (NOT ECC Curve 25519)
- ✅ ECC keys cause compatibility issues in GitHub Actions
- ✅ The workflow now auto-configures GPG for non-interactive use

## Need More Help?

See the full guide: [docs/GPG_SETUP.md](./GPG_SETUP.md)
