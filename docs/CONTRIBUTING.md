# Contributing to GhostClass

Thank you for your interest in contributing to GhostClass! This guide will help you understand our development workflow and contribution process.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Automatic Version Bumping](#automatic-version-bumping)
- [Pull Request Process](#pull-request-process)
- [Code Quality](#code-quality)
- [Testing](#testing)
- [Commit Messages](#commit-messages)

## Getting Started

### Prerequisites

- Node.js 20.19.0+ or 22.12.0+
- npm 11+
- Git

### Setup

1. Fork the repository (or create a branch if you have write access)
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/GhostClass.git
   cd GhostClass
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running Locally

```bash
# Development server
npm run dev

# Development server with HTTPS (requires certificates)
npm run dev:https

# Build for production
npm run build

# Run linter
npm run lint

# Run tests
npm run test
npm run test:e2e
```

### Making Changes

1. Make your changes in your feature branch
2. Write or update tests as needed
3. Run tests to ensure everything works:
   ```bash
   npm run test
   npm run lint
   ```
4. Commit your changes with a clear message (see [Commit Messages](#commit-messages))
5. Push your branch to GitHub

## Automatic Version Bumping

GhostClass uses an **automatic version bumping system** that handles versioning for you!

### For Same-Repository PRs (Contributors with Write Access)

When you create a Pull Request from a branch in the main repository:

1. ✨ **Auto-Bump Workflow Runs**: The workflow automatically checks your PR
2. 📦 **Version Check**: Compares your branch version with `main`
3. 🔄 **Auto-Increment**: If versions match, automatically bumps the patch version
4. 💾 **Auto-Commit**: Commits version changes directly to your PR branch
5. 💬 **Bot Comment**: Leaves a comment confirming the version bump
6. 🔄 **Workflow Triggering** (if `BOT_PAT` is configured):
   - Tests and Pipeline workflows run automatically after version bump commit
   - All checks complete properly
   - See [BOT_PAT_SETUP.md](BOT_PAT_SETUP.md) for maintainer configuration

**You don't need to do anything!** The version is bumped automatically. 🎉

> **Note for Maintainers**: To enable workflows to run after version bump commits, configure a `BOT_PAT` secret. See [BOT_PAT_SETUP.md](BOT_PAT_SETUP.md) for setup instructions. Without this, version bump commits won't trigger workflows (expected GitHub behavior).

#### What Gets Updated

The auto-bump workflow updates:
- `package.json` and `package-lock.json`
- `.example.env` (NEXT_PUBLIC_APP_VERSION)
- `public/api-docs/openapi.yaml`

### For Fork PRs (External Contributors)

If you're contributing from a forked repository:

1. **Create your PR** as normal
2. **Check for bot comment**: A workflow will comment with version bump instructions
3. **Run the bump script** on your PR branch:
   ```bash
   CI=true GITHUB_HEAD_REF="$(git rev-parse --abbrev-ref HEAD)" node scripts/bump-version.js
   ```
4. **Commit and push** the version changes:
   ```bash
   git add package.json package-lock.json .example.env public/api-docs/openapi.yaml
   git commit -m "chore: bump version"
   git push
   ```

**Why manual for forks?** For security reasons, GitHub Actions cannot write to fork branches automatically. This prevents malicious code from being injected into PRs.

### Rollover Versioning

GhostClass uses a rollover versioning system where minor and patch components (Y and Z in X.Y.Z) must be 0-9, while major version (X) can exceed 9:

```
1.6.9 → 1.7.0   (patch rollover)
1.9.9 → 2.0.0   (minor rollover)
9.9.9 → 10.0.0  (major version exceeds 9)
```

For more details, see [VERSIONING.md](VERSIONING.md).

## Pull Request Process

### Creating a PR

1. **Push your branch** to GitHub
2. **Open a Pull Request** against the `main` branch
3. **Wait for auto-bump** (same-repo) or **manually bump** (fork)
4. **Fill in the PR template** with:
   - Description of changes
   - Related issue numbers
   - Testing notes
5. **Request review** from maintainers

### PR Checklist

- [ ] Tests pass locally
- [ ] Code follows project style guidelines
- [ ] Version is bumped (auto or manual)
- [ ] Documentation is updated (if needed)
- [ ] Commit messages are clear and descriptive

### Review Process

1. Automated tests run on your PR
2. Maintainers review your code
3. Address any feedback or requested changes
4. Once approved, a maintainer will merge your PR

### After Merge

When your PR is merged:

1. **Auto-Tag**: A signed git tag is automatically created
2. **Release**: The release workflow builds and publishes the Docker image
3. **Cleanup**: Your feature branch is automatically deleted

## Code Quality

### Linting

We use ESLint for code quality:

```bash
npm run lint
```

### Code Style

- Use TypeScript for type safety
- Follow existing code patterns
- Write meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### End-to-End Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed
```

### Writing Tests

- Write tests for new features
- Update tests when changing existing features
- Aim for good test coverage
- Test edge cases and error conditions

## Commit Messages

We follow conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (version bumps, etc.)

### Examples

```
feat(auth): add JWT authentication support

Implements JWT-based authentication for API endpoints.
Includes token generation, validation, and refresh logic.

Closes #123
```

```
fix(api): handle null response in user endpoint

Fixes crash when user data is missing from database.

Fixes #456
```

```
chore: bump version to v1.7.0

Automatic version bump from workflow.
```

## Questions or Issues?

- **Bug Reports**: Open an issue with the bug template
- **Feature Requests**: Open an issue with the feature template
- **Questions**: Start a discussion or ask in an issue

## License

By contributing, you agree that your contributions will be licensed under the project's license.

---

Thank you for contributing to GhostClass! 🚀
