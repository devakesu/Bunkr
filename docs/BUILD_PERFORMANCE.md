# Docker Build Performance Optimization

This document explains the build performance optimizations implemented to reduce workflow execution time from >10 minutes to ~5-8 minutes.

## Problem Statement

The original build workflows were taking over 10 minutes to complete, with the following issues:

1. **No Docker layer caching** - Every build started from scratch
2. **Unnecessary multi-architecture builds** - ARM64 builds added 5+ minutes even when not needed
3. **No build time visibility** - Unclear which stages were taking the most time

## Solutions Implemented

### 1. Docker Layer Caching (PRIMARY FIX)

**Impact**: Reduces build time by ~50% (5-7 minutes) for incremental builds

Both `pipeline.yml` and `release.yml` now use GitHub Actions cache:

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

**How it works**:
- `type=gha` uses GitHub Actions cache backend (free, 10GB limit)
- `mode=max` caches all layers, not just the final image
- Subsequent builds reuse cached layers for:
  - Base image layers
  - npm dependencies (if package-lock.json unchanged)
  - Built Next.js application (if source unchanged)

**Cache behavior**:
- Cache is scoped per branch and workflow
- Cache expires after 7 days of inactivity
- Cache is automatically invalidated when Dockerfile or dependencies change

### 2. Conditional ARM64 Builds (SECONDARY FIX)

**Impact**: Saves 3-5 minutes for quick test releases

The release workflow now intelligently selects build platforms:

| Trigger Type | Platforms Built | Reason |
|-------------|----------------|--------|
| Tag push (`v*.*.*`) | AMD64 + ARM64 | Full production release needs both |
| Manual dispatch (default) | AMD64 only | Faster test releases |
| Manual dispatch (ARM64 enabled) | AMD64 + ARM64 | When ARM64 is specifically needed |

**Usage**:

For quick test releases:
```bash
gh workflow run release.yml --field bump_type=patch
# Builds AMD64 only (~5-8 minutes)
```

For production releases with ARM64:
```bash
gh workflow run release.yml --field bump_type=patch --field build_arm64=true
# Builds AMD64 + ARM64 (~8-12 minutes)
```

Tag pushes automatically build both architectures:
```bash
git tag v1.5.7
git push origin v1.5.7
# Builds AMD64 + ARM64 (full production release)
```

## Performance Comparison

### Before Optimization

```
pipeline.yml (CI - Main Branch):
├─ Setup: ~30s
├─ Build AMD64 (no cache): ~4-5 min
├─ Signing & Attestations: ~1-2 min
└─ Total: ~6-8 minutes

release.yml (Production Releases):
├─ Setup: ~30s
├─ Build AMD64 (no cache): ~5-6 min
├─ Build ARM64 (no cache, emulated): ~6-8 min
├─ Signing & Attestations: ~1-2 min
└─ Total: ~13-17 minutes ❌
```

### After Optimization

```
pipeline.yml (CI - Main Branch):
├─ Setup: ~30s
├─ Build AMD64 (cached): ~1-2 min
├─ Signing & Attestations: ~1-2 min
└─ Total: ~3-5 minutes ✅ (50% faster)

release.yml (Test - AMD64 only):
├─ Setup: ~30s
├─ Build AMD64 (cached): ~1-2 min
├─ Signing & Attestations: ~1-2 min
└─ Total: ~3-5 minutes ✅ (70% faster)

release.yml (Production - Multi-arch):
├─ Setup: ~30s
├─ Build AMD64 (cached): ~1-2 min
├─ Build ARM64 (cached): ~2-3 min
├─ Signing & Attestations: ~1-2 min
└─ Total: ~5-8 minutes ✅ (50% faster)
```

## Cache Effectiveness

The cache is most effective when:
- ✅ Dependencies haven't changed (package-lock.json)
- ✅ Base images haven't changed (Dockerfile FROM statements)
- ✅ Source code changes are incremental

The cache provides minimal benefit when:
- ❌ Dependencies are updated (npm packages)
- ❌ Dockerfile structure changes significantly
- ❌ Building on a new branch for the first time

## Monitoring Build Performance

### GitHub Actions Insights

View build times in GitHub Actions:
1. Go to **Actions** tab
2. Select a workflow run
3. Check the "Build & push image" step duration

### Cache Hit Rate

Monitor cache effectiveness:
```bash
# View cache usage
gh api /repos/OWNER/REPO/actions/caches
```

The buildx logs will show cache usage:
- `CACHED` - Layer retrieved from cache
- `DONE` - Layer rebuilt

## Best Practices

### For Developers

1. **Test builds locally first** before pushing:
   ```bash
   docker buildx build --platform linux/amd64 .
   ```

2. **Use AMD64-only for quick tests**:
   - Only enable ARM64 when actually needed
   - Tag pushes automatically build both

3. **Keep dependencies up to date**:
   - Batch dependency updates to minimize cache invalidation
   - Consider weekly dependency update PRs

### For Maintainers

1. **Monitor build times** regularly:
   - Check GitHub Actions insights
   - Alert if builds exceed 10 minutes consistently

2. **Clear cache if needed**:
   ```bash
   gh cache delete --all
   ```

3. **Consider upgrading to larger runners** if cache isn't sufficient:
   - GitHub-hosted larger runners have better performance
   - Self-hosted runners eliminate network overhead

## Troubleshooting

### Builds are still slow

1. **Check if cache is working**:
   - Look for `CACHED` messages in build logs
   - Verify cache-from/cache-to are present

2. **Check for cache invalidation**:
   - Did Dockerfile change?
   - Did package-lock.json change?
   - Is this a new branch?

3. **Check ARM64 build necessity**:
   - For manual dispatch, disable ARM64 if not needed
   - ARM64 emulation is inherently slower

### Cache not working

1. **Verify permissions**:
   - Workflow needs `actions: write` permission for cache
   - Check workflow permissions in .github/workflows/

2. **Check cache size**:
   - GitHub Actions cache has 10GB limit per repository
   - Old caches are automatically evicted

3. **Try clearing cache**:
   ```bash
   gh cache delete --all
   ```

## Future Optimizations

Potential further improvements:

1. **Native ARM64 runners**: When GitHub Actions supports them, eliminate emulation overhead
2. **Build matrix**: Parallel builds for ARM64 and AMD64 (current limitation: single job)
3. **Dockerfile optimization**: Further optimize layer ordering for better caching
4. **Pre-built base images**: Maintain custom base images with dependencies

## References

- [Docker Buildx Cache Backends](https://docs.docker.com/build/cache/backends/)
- [GitHub Actions Cache](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
