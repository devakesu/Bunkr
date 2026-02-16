# GPG Key Setup for Auto-Version-Bump Workflow

This guide explains how to generate a GPG key and configure it for the auto-version-bump workflow to create verified commits.

## Prerequisites

- GPG installed on your local machine
- Access to repository Settings → Secrets and variables → Actions
- A verified email address in your GitHub account

## Step 1: Generate a GPG Key

Run the following commands on your local machine:

```bash
# Generate a new GPG key
gpg --full-generate-key
```

When prompted:
1. **Key type**: Select `(1) RSA and RSA (default)`
2. **Key size**: Enter `4096`
3. **Key validity**: Enter `0` (key does not expire) or set an expiration
4. **Real name**: Enter your name (e.g., "Your Name" or "GhostClass Bot")
5. **Email address**: Enter your verified GitHub email (e.g., `yourname@example.com` or `61821107+devakesu@users.noreply.github.com`)
6. **Comment**: Optional, can leave blank
7. **Passphrase**: Enter a strong passphrase (you'll need this later)

## Step 2: Export Your GPG Key

After generating the key, export it:

```bash
# List your GPG keys to get the key ID
gpg --list-secret-keys --keyid-format=long

# You'll see output like:
# sec   rsa4096/ABC123DEF456 2024-01-01 [SC]
#       1234567890ABCDEF1234567890ABCDEF12345678
# uid                 [ultimate] Your Name <your-email@example.com>
# ssb   rsa4096/XYZ789ABC123 2024-01-01 [E]

# Export the private key (replace ABC123DEF456 with your key ID)
gpg --armor --export-secret-keys ABC123DEF456

# Export the public key
gpg --armor --export ABC123DEF456
```

## Step 3: Add GPG Key to GitHub Account

1. Go to GitHub → Settings → SSH and GPG keys
2. Click "New GPG key"
3. Paste your **public key** (the output from `gpg --armor --export`)
4. Click "Add GPG key"

## Step 4: Verify Your Email Address

1. Go to GitHub → Settings → Emails
2. Ensure the email address used in your GPG key is listed and verified
3. If not verified, click "Resend verification email" and follow the link

## Step 5: Add Secrets to Repository

Go to your repository → Settings → Secrets and variables → Actions, and add:

### Required Secrets:

1. **GPG_PRIVATE_KEY**
   - Value: Your private key (output from `gpg --armor --export-secret-keys`)
   - This is the entire output including:
     ```
     -----BEGIN PGP PRIVATE KEY BLOCK-----
     ...
     -----END PGP PRIVATE KEY BLOCK-----
     ```

2. **GPG_PASSPHRASE**
   - Value: The passphrase you set when generating the key

### Optional Secrets (recommended):

3. **GPG_COMMITTER_NAME**
   - Value: The name to use for commits (e.g., "GhostClass Bot" or your name)
   - If not set, defaults to "GhostClass Bot"

4. **GPG_COMMITTER_EMAIL**
   - Value: The email address from your GPG key (must be verified in GitHub)
   - If not set, defaults to "61821107+devakesu@users.noreply.github.com"

## Step 6: Test the Setup

1. Create a test PR to trigger the auto-version-bump workflow
2. Check that the version bump commit shows as "Verified" with a green checkmark
3. Verify the commit is signed with your GPG key

## Using GitHub's No-Reply Email

If you want to keep your email private, you can use GitHub's no-reply email:

1. Go to GitHub → Settings → Emails
2. Check "Keep my email addresses private"
3. GitHub will provide you with a no-reply email like: `123456+username@users.noreply.github.com`
4. Use this email when generating your GPG key
5. This email is automatically verified

## Troubleshooting

### Commits Show as "Unverified"

- **Cause**: Email address in GPG key doesn't match a verified email in your GitHub account
- **Solution**: 
  1. Verify the email in GitHub Settings → Emails
  2. Or generate a new GPG key with a verified email address

### "No secret key" Error

- **Cause**: Private key not properly added to repository secrets
- **Solution**: Ensure you copied the entire private key including headers and footers

### "Bad passphrase" Error

- **Cause**: Incorrect passphrase in repository secrets
- **Solution**: Double-check the GPG_PASSPHRASE secret matches your key's passphrase

## Security Best Practices

1. **Never share your private key**: Only add it to repository secrets, never commit it
2. **Use a strong passphrase**: Protect your GPG key with a strong passphrase
3. **Rotate keys periodically**: Consider setting an expiration date and rotating keys
4. **Backup your key**: Keep a secure backup of your GPG key
5. **Use repository secrets**: Never hardcode sensitive information in workflow files

## Example Configuration

After setup, your workflow will use:

```yaml
- name: Import GPG key (same-repo only)
  uses: crazy-max/ghaction-import-gpg@v6.1.0
  with:
    gpg_private_key: ${{ secrets.GPG_PRIVATE_KEY }}
    passphrase: ${{ secrets.GPG_PASSPHRASE }}
    git_user_signingkey: true
    git_commit_gpgsign: true
    git_config_global: true
    git_committer_name: ${{ secrets.GPG_COMMITTER_NAME || 'GhostClass Bot' }}
    git_committer_email: ${{ secrets.GPG_COMMITTER_EMAIL || '61821107+devakesu@users.noreply.github.com' }}
```

## Additional Resources

- [GitHub: Managing commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification)
- [GitHub: Generating a new GPG key](https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key)
- [GitHub: Adding a GPG key to your GitHub account](https://docs.github.com/en/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account)
