# Bot PAT Setup for Workflow Triggering

This document explains how to configure a Personal Access Token (PAT) to enable workflows to trigger after automated version bump commits.

## Why is this needed?

By default, when a GitHub Actions workflow creates a commit using `GITHUB_TOKEN`, that commit **does not trigger other workflows**. This is intentional GitHub behavior to prevent infinite workflow loops.

For GhostClass, this means:
- When the Auto Version Bump workflow commits a version bump to your PR
- The Tests and Pipeline workflows won't run on that version bump commit
- The checks will show as "waiting" because they're expected but never triggered

## Solution: Use a Bot PAT

By using a Personal Access Token (PAT) instead of `GITHUB_TOKEN`, commits made by the workflow **will trigger** subsequent workflows.

### Benefits
- ✅ Tests run after version bump commits
- ✅ All checks complete properly
- ✅ Maintains OpenSSF Scorecard compliance (no `pull_request_target` needed)
- ✅ Graceful fallback to `GITHUB_TOKEN` if PAT not configured

## Setup Instructions

### Step 1: Create a Personal Access Token

1. Go to **GitHub Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
   - Or visit: https://github.com/settings/tokens

2. Click **Generate new token** → **Generate new token (classic)**

3. Configure the token:
   - **Note**: `GhostClass Bot PAT` (or similar descriptive name)
   - **Expiration**: Choose based on your preference (recommendation: 90 days or 1 year)
   - **Scopes**: Select **only** these permissions:
     - ✅ `repo` (Full control of private repositories)
       - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
   
4. Click **Generate token**

5. **⚠️ IMPORTANT**: Copy the token immediately - you won't be able to see it again!

### Step 2: Add Token to Repository Secrets

1. Go to your repository on GitHub

2. Navigate to **Settings** → **Secrets and variables** → **Actions**

3. Click **New repository secret**

4. Add the secret:
   - **Name**: `BOT_PAT` (must be exactly this name)
   - **Secret**: Paste the PAT you copied in Step 1

5. Click **Add secret**

### Step 3: Verify Setup

The `auto-version-bump.yml` workflow is already configured to use this token:

```yaml
token: ${{ secrets.BOT_PAT || secrets.GITHUB_TOKEN }}
```

This means:
- If `BOT_PAT` exists → workflows will trigger after version bump commits ✅
- If `BOT_PAT` is not configured → falls back to `GITHUB_TOKEN` (original behavior)

To verify it's working:
1. Create a new PR
2. The Auto Version Bump workflow will run and commit a version bump
3. After the version bump commit, the Tests and Pipeline workflows should trigger automatically
4. All checks should complete (not stuck in "waiting")

## Security Considerations

### Token Scope
The PAT has `repo` scope, which grants full access to your repository. This is necessary because:
- The workflow needs to push commits to PR branches
- GitHub requires this scope to trigger workflows

### Token Security
- ✅ Tokens are stored as encrypted secrets in GitHub
- ✅ Token values are never exposed in workflow logs
- ✅ Token is only accessible to workflows in your repository
- ✅ You can revoke the token anytime from your GitHub settings

### Best Practices
1. **Use a dedicated bot account** (optional but recommended):
   - Create a separate GitHub account for automation
   - Generate the PAT from that account
   - Add the bot account as a collaborator to your repository
   - This isolates the PAT from your personal account

2. **Set appropriate expiration**:
   - Tokens should expire to limit exposure if compromised
   - Set a reminder to renew before expiration
   - GitHub will send email notifications before expiration

3. **Audit token usage**:
   - Regularly review which workflows use the PAT
   - Check workflow run logs for any suspicious activity
   - Revoke and regenerate if compromised

## Troubleshooting

### Workflows still not triggering after version bump

**Check 1: Is the PAT configured?**
- Go to repository Settings → Secrets → Actions
- Verify `BOT_PAT` secret exists

**Check 2: Does the PAT have the right permissions?**
- The token must have `repo` scope
- Regenerate if needed with correct scope

**Check 3: Has the token expired?**
- Check token expiration in GitHub settings
- Regenerate if expired

**Check 4: Is the workflow file updated?**
- Verify `.github/workflows/auto-version-bump.yml` contains:
  ```yaml
  token: ${{ secrets.BOT_PAT || secrets.GITHUB_TOKEN }}
  ```

### How to revert to original behavior

If you want to revert to the original behavior (no workflow triggering after bot commits):

1. Delete the `BOT_PAT` secret from repository settings
2. The workflow will automatically fall back to `GITHUB_TOKEN`

No code changes needed - the fallback is built-in.

## OpenSSF Scorecard Impact

Using a PAT **does not affect** your OpenSSF Scorecard score because:
- ✅ No `pull_request_target` trigger (the main security concern)
- ✅ No untrusted code checkout with explicit refs
- ✅ Standard checkout behavior maintained
- ✅ All security best practices followed

The PAT is used only for authentication, not for accessing untrusted code.

## Related Documentation

- [VERSIONING.md](VERSIONING.md) - Versioning system and auto-bump workflow
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [GPG_SETUP.md](GPG_SETUP.md) - GPG signing configuration
