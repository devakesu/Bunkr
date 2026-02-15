# Versioning System

GhostClass uses a **rollover versioning system** with the format `X.Y.Z` where minor and patch components are constrained to single digits (0-9), while the major version can grow beyond 9.

## Version Format

```
X.Y.Z
```

Where:
- **X** = Major version (can grow beyond 9, e.g., 10, 11, ...)
- **Y** = Minor version (0-9, rolls over to increment major)
- **Z** = Patch version (0-9, rolls over to increment minor)

### Constraint: Single Digit Minor and Patch

Minor and patch components **must** be between 0 and 9. When a component reaches 10, it "rolls over" to 0 and increments the next higher component. The major version can grow beyond 9.

## Rollover Logic

### Patch Rollover

When the patch version reaches 9, the next increment rolls over to the minor version:

```
1.6.9 → 1.7.0
```

### Minor Rollover

When both patch and minor versions reach 9, the next increment rolls over to the major version:

```
1.9.9 → 2.0.0
```

### Examples

```
1.5.8 → 1.5.9  (normal increment)
1.5.9 → 1.6.0  (patch rollover)
1.9.8 → 1.9.9  (normal increment)
1.9.9 → 2.0.0  (minor and patch rollover)
2.9.9 → 3.0.0  (minor and patch rollover)
```

## Why Rollover Versioning?

This versioning scheme provides several benefits:

1. **Readability**: Version numbers stay compact and easy to read
2. **Consistency**: Predictable pattern for version increments
3. **Simplicity**: Easy to understand and implement
4. **Semantic Clarity**: Clear distinction between major, minor, and patch releases

## Automatic Version Bumping

### For Same-Repository PRs

When you create a Pull Request from a branch in the main repository:

1. The **Auto Version Bump** workflow automatically checks if the version needs to be bumped
2. If the PR's version matches the version on `main`, it automatically:
   - Increments the patch version using rollover logic
   - Updates all version files (package.json, .example.env, openapi.yaml)
   - Commits the changes to your PR branch
   - Leaves a comment on the PR

**You don't need to manually bump the version!** ✨

### For Fork PRs

If you're contributing from a forked repository:

1. The **Auto Version Bump** workflow will check your version
2. For fork PRs, the workflow cannot push changes to your fork due to security restrictions
3. The workflow will attempt to leave a comment with instructions (note: commenting on forks may fail due to token permissions)
4. If you receive a comment or if the workflow detects your version needs updating:
   - Run the manual version bump command on your PR branch (see below)
   - Commit and push the version bump changes to your fork

## Manual Version Bumping

If you need to manually bump the version:

```bash
# From your PR branch, run the version bump script with PR context:
CI=true GITHUB_HEAD_REF="$(git rev-parse --abbrev-ref HEAD)" node scripts/bump-version.js
```

The script updates:
- `package.json` and `package-lock.json`
- `.example.env` (NEXT_PUBLIC_APP_VERSION)
- `public/api-docs/openapi.yaml`

## Version Normalization

If a version violates the 0-9 constraint (e.g., from external tools or manual edits), the script automatically normalizes it:

```
1.5.11 → 1.6.0  (patch 11 rolls to minor)
1.12.5 → 2.0.0  (minor 12 rolls to major, patch resets)
```

## Release Process

1. **Create PR**: When you create a PR, the version is auto-bumped (or you manually bump for forks)
2. **Review & Merge**: After review and tests pass, merge the PR to `main`
3. **Auto-Tag**: The pipeline automatically creates a signed git tag (`vX.Y.Z`)
4. **Release**: The release workflow builds and publishes the Docker image

## Version Tags

Tags follow the format `vX.Y.Z` (with a `v` prefix):

```
v1.6.3
v1.7.0
v2.0.0
```

All tags are **GPG-signed** for security and provenance.

## Checking Current Version

```bash
# From package.json
node -p "require('./package.json').version"

# From git tags
git describe --tags --abbrev=0
```

## Related Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute and work with the auto-bump workflow
- [README.md](../README.md) - Project overview and getting started
