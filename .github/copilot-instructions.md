# GhostClass - Copilot Agent Instructions

This file provides comprehensive guidance for AI coding agents working on the GhostClass repository. Following these instructions will help you work efficiently and maintain code quality.

## Repository Overview

**GhostClass** is a production-grade academic attendance tracking application built with Next.js 16 (React 19), TypeScript, and Supabase. It integrates with EzyGo attendance systems and provides students with real-time attendance analytics, "bunk calculators", and tracking capabilities.

**Key Characteristics:**
- **Security-First**: AES-256-GCM encryption, CSP Level 3, rate limiting, SLSA Level 3 compliance
- **Performance-Optimized**: PWA with service workers, React Query caching, LRU cache, code splitting
- **Type-Safe**: Strict TypeScript mode with comprehensive type checking
- **Well-Tested**: Vitest for unit tests, Playwright for E2E, 10% coverage threshold enforced
- **Production-Ready**: Docker containerization, multi-platform builds, reproducible releases

## Tech Stack

### Core Framework
- **Next.js 16.1.6** with App Router (React 19.2.3)
- **TypeScript 5.9.3** - Strict mode enabled
- **Node.js** - v20.19.0+ or v22.12.0+

### Frontend
- **Tailwind CSS 4** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **Shadcn UI** - Pre-styled components (in `src/components/ui/`)
- **Framer Motion** - Animations with `domAnimation` only
- **Lucide React** - Icons
- **TanStack Query v5** - Server state management
- **React Hook Form + Zod v4** - Form validation
- **Recharts v3** - Data visualization

### Backend & Infrastructure
- **Supabase** - PostgreSQL with Row Level Security
- **Axios v1** - HTTP client with retry logic
- **Upstash Redis** - Rate limiting
- **Sentry** - Error tracking and performance monitoring
- **Cloudflare Turnstile** - Bot protection

### Testing & Quality
- **Vitest 4.0.18** - Unit/component testing with v8 coverage
- **Playwright 1.58.0** - E2E testing (Chromium, Firefox, WebKit)
- **ESLint 9** - Flat config with TypeScript support
- **Husky + lint-staged** - Pre-commit hooks

### DevOps
- **Docker** - Multi-stage builds with Alpine Linux
- **GitHub Actions** - CI/CD with automatic versioning
- **SLSA Level 3** - Supply chain security with provenance attestation

## Project Structure

```
/home/runner/work/GhostClass/GhostClass/
├── .github/
│   ├── workflows/          # CI/CD pipelines
│   │   ├── pipeline.yml    # Main pipeline (version bumping, tagging)
│   │   ├── test.yml        # Unit & E2E tests
│   │   ├── release.yml     # Release workflow (Docker builds, deployments)
│   │   └── auto-version-bump.yml  # Automatic version management
│   └── copilot-instructions.md  # This file
├── docs/                   # Detailed documentation
│   ├── CONTRIBUTING.md     # Contribution guidelines
│   ├── VERSIONING.md       # Rollover versioning system
│   └── BOT_PAT_SETUP.md    # Workflow trigger configuration
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── (auth)/         # Authentication routes (login, signup)
│   │   ├── (protected)/    # Authenticated routes (dashboard, profile)
│   │   ├── (public)/       # Public routes (home, contact, legal)
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # Auth endpoints
│   │   │   ├── backend/    # EzyGo proxy endpoints
│   │   │   └── cron/       # Scheduled jobs
│   │   ├── actions/        # Server actions
│   │   ├── config/         # App configuration
│   │   ├── globals.css     # Global styles + Tailwind directives
│   │   └── layout.tsx      # Root layout with providers
│   ├── components/         # React components
│   │   ├── ui/             # Shadcn UI base components
│   │   ├── attendance/     # Attendance-specific components
│   │   ├── layout/         # Layout components (navbar, footer)
│   │   └── user/           # User-related components
│   ├── hooks/              # Custom React hooks (organized by feature)
│   │   ├── courses/        # Course data hooks
│   │   ├── tracker/        # Tracking hooks
│   │   └── users/          # User hooks
│   ├── lib/                # Core library code
│   │   ├── logic/          # Business logic (bunk.ts algorithm)
│   │   ├── supabase/       # Supabase client configuration
│   │   ├── crypto.ts       # AES-256-GCM encryption
│   │   ├── ratelimit.ts    # Upstash Redis rate limiting
│   │   └── utils.ts        # Utility functions (cn, formatters)
│   ├── types/              # TypeScript definitions
│   │   ├── attendance.d.ts # Attendance types
│   │   ├── course.d.ts     # Course types
│   │   └── user.d.ts       # User types
│   ├── providers/          # React context providers
│   ├── assets/             # Static assets (images, icons)
│   └── sw.ts               # Service worker (Serwist PWA)
├── supabase/
│   └── migrations/         # Database schema migrations
├── e2e/                    # Playwright E2E tests
├── scripts/                # Utility scripts (version management)
├── public/                 # Static files (manifest, robots.txt)
├── Dockerfile              # Multi-stage Docker build
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint flat config
├── vitest.config.ts        # Vitest configuration
├── playwright.config.ts    # Playwright configuration
└── next.config.ts          # Next.js configuration
```

## Development Workflow

### Initial Setup

```bash
# Clone and install
git clone https://github.com/devakesu/GhostClass.git
cd GhostClass
npm install

# Set up environment
cp .example.env .env
# Edit .env with your credentials

# Set up Supabase (requires Supabase CLI)
npx supabase login
npx supabase link --project-ref <your-project-id>
npx supabase db push  # Push migrations to remote database
```

### Available Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run dev` | Start dev server (webpack) | Regular development |
| `npm run dev:https` | Dev with HTTPS | Testing HTTPS-specific features (requires SSL certs in `./certificates/`) |
| `npm run build` | Production build | Before deployment, testing builds |
| `npm run start` | Start production server | Testing production builds locally |
| `npm run lint` | Run ESLint with auto-fix | Before committing, fixing linting issues |
| `npm test` | Run unit tests | Quick test validation |
| `npm run test:watch` | Unit tests (watch mode) | Active TDD development |
| `npm run test:ui` | Vitest UI dashboard | Debugging test failures |
| `npm run test:coverage` | Coverage report | Checking test coverage |
| `npm run test:e2e` | Playwright E2E tests | Testing full user flows |
| `npm run test:e2e:ui` | E2E with UI mode | Debugging E2E failures |
| `npm run test:all` | Coverage + E2E | Before PR submission |
| `npm run docs:validate` | Validate OpenAPI spec | After API documentation changes |
| `npm run verify-version` | Check version consistency | Debugging version issues |
| `npm run bump-version` | Manual version bump | Fork PRs only (auto-bump for same-repo PRs) |

### Testing Before Committing

**ALWAYS run these before committing:**

```bash
npm run lint          # Fix linting issues
npm run test          # Verify unit tests pass
npm run build         # Ensure production build works
```

**For significant changes, also run:**

```bash
npm run test:coverage  # Verify coverage thresholds met
npm run test:e2e       # Verify E2E tests pass
```

## Code Conventions

### TypeScript Standards

**Strict Mode Enabled** - All TypeScript rules enforced:
- `strict: true` - No implicit any, null checks, strict function types
- `noUnusedLocals: true` - No unused variables
- `noUnusedParameters: true` - No unused parameters (use `_` prefix to ignore)
- `noImplicitReturns: true` - All code paths must return
- `noFallthroughCasesInSwitch: true` - No switch fallthrough

**Path Aliases:**
- `@/*` → `./src/*` (always use this for imports)

**Examples:**
```typescript
// ✅ Good
import { Button } from '@/components/ui/button';
import { calculateAttendance } from '@/lib/logic/bunk';

// ❌ Bad
import { Button } from '../../components/ui/button';
```

### Component Patterns

**Shadcn UI Components** (`src/components/ui/`):
- Use Radix UI primitives with Class Variance Authority (CVA)
- Props include `className` for custom styling
- Use `asChild` prop for composition (renders as child element)

**Example:**
```tsx
import { Button } from '@/components/ui/button';

// ✅ Button as anchor tag (no nested interactive elements)
<Button asChild>
  <a href="/external" target="_blank" rel="noopener noreferrer">
    External Link
  </a>
</Button>

// ✅ Custom styling with cn utility
<Button className={cn("bg-primary", isDanger && "bg-destructive")}>
  Submit
</Button>
```

**Class Merging:**
- Use `cn()` utility from `@/lib/utils` for class merging
- Tailwind classes merged intelligently with `tailwind-merge`

### Hook Patterns

**React Query Hooks:**
- Place in `src/hooks/` organized by feature
- Include comprehensive JSDoc comments
- Return normalized data structures (keyed objects, not arrays)

**Example Structure:**
```typescript
/**
 * Fetches course data from the backend.
 * 
 * @param userId - User ID to fetch courses for
 * @param options - React Query options
 * @returns Query result with courses keyed by course ID
 * 
 * @example
 * ```tsx
 * const { data: courses, isLoading } = useFetchCourses(userId);
 * ```
 */
export function useFetchCourses(
  userId: string,
  options?: UseQueryOptions
) {
  return useQuery({
    queryKey: ['courses', userId],
    queryFn: async () => {
      // Fetch and normalize data
      return normalizedCourses;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    ...options,
  });
}
```

### File Organization

**Naming Conventions:**
- Components: PascalCase (`CourseCard.tsx`, `AttendanceChart.tsx`)
- Utilities: camelCase (`bunk.ts`, `utils.ts`)
- Types: PascalCase with `.d.ts` extension (`course.d.ts`)
- Tests: `*.test.ts` or `*.spec.ts` in `__tests__/` folders

**Component Structure:**
```
src/components/
├── ui/                    # Base components (Shadcn)
├── attendance/            # Feature-specific components
│   ├── course-card.tsx
│   ├── attendance-calendar.tsx
│   └── attendance-chart.tsx
└── layout/                # Layout components
    ├── navbar.tsx
    └── footer.tsx
```

## ESLint & Code Style

### ESLint Configuration

**Flat Config (eslint.config.mjs)** - ESLint 9.x format:
- TypeScript ESLint with recommended rules
- React + React Hooks plugins
- Next.js plugin for Next.js-specific rules

**Key Rules:**
- `@typescript-eslint/no-explicit-any`: Off (allowed for flexibility)
- `@typescript-eslint/ban-ts-comment`: Off (allows `@ts-expect-error`)
- Unused vars: Warn (use `_` prefix to ignore: `_unusedVar`)
- `react/react-in-jsx-scope`: Off (modern React doesn't require imports)

**Scripts Directory:**
- `@typescript-eslint/no-require-imports`: Off (Node.js scripts)
- `no-console`: Off (logging allowed in scripts)

### Tailwind CSS

**v4 Syntax** - PostCSS plugin, utility-first approach:
- Use correct class names: `bg-gradient-to-*` (not `bg-linear-to-*`)
- Break words: `break-words` (not `wrap-break-word`)
- Custom properties: `[background-size:*]` (not `bg-size-*`)
- Data attributes: `data-[attribute]` (not `data-attribute`)
- Important: `!class` (not `class!`)
- CSS vars: Wrap with `var()` - `bg-[var(--color)]`

**Optimized Imports:**
- `lucide-react` - Tree-shaking enabled
- `date-fns` - Tree-shaking enabled
- `framer-motion` - Only `domAnimation` features imported

### Pre-commit Hooks

**Husky + lint-staged** - Runs automatically on `git commit`:
1. Type check all `*.ts/*.tsx` files
2. ESLint auto-fix on all JS/TS files
3. Fails commit if type errors or unfixable linting issues

**To skip (not recommended):**
```bash
git commit --no-verify -m "message"
```

## Testing Guidelines

### Unit Testing (Vitest)

**Configuration:**
- Environment: jsdom (browser simulation)
- Coverage: v8 provider with HTML/LCOV reports
- Thresholds: Lines 7%, Functions 8%, Branches 5%, Statements 7%

**Test Structure:**
```typescript
import { describe, it, expect } from 'vitest';
import { calculateAttendance } from '@/lib/logic/bunk';

describe('calculateAttendance', () => {
  it('should calculate required classes when below target', () => {
    // Arrange
    const present = 40;
    const total = 60;
    const target = 75;
    
    // Act
    const result = calculateAttendance(present, total, target);
    
    // Assert
    expect(result.requiredToAttend).toBe(6);
    expect(result.canBunk).toBe(0);
  });
});
```

**Testing React Components:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseCard } from '@/components/attendance/course-card';

it('should display attendance percentage', () => {
  render(<CourseCard course={mockCourse} />);
  expect(screen.getByText('75.0%')).toBeInTheDocument();
});
```

**Coverage Location:**
- Report: `coverage/index.html`
- LCOV: `coverage/lcov.info`

### E2E Testing (Playwright)

**Configuration:**
- Base URL: `http://localhost:3000`
- Projects: Chromium, Firefox, WebKit, Mobile Chrome
- CI: Chromium only (faster)
- Retries: 2 in CI, 0 locally

**Test Structure:**
```typescript
import { test, expect } from '@playwright/test';

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/GhostClass/);
});
```

**Running E2E Tests:**
- `npm run test:e2e` - Headless (CI mode)
- `npm run test:e2e:ui` - Interactive UI (debugging)
- `npm run test:e2e:headed` - Headed mode (visible browser)

### Test Coverage Requirements

**Minimum Thresholds:**
- **10% overall** (enforced in vitest.config.ts)
- **100% critical paths** (attendance calculation, encryption)

**Priority Areas:**
1. Business logic (`src/lib/logic/`)
2. Security functions (`crypto.ts`, `ratelimit.ts`)
3. Utility functions (`utils.ts`)
4. Custom hooks (`src/hooks/`)
5. Critical components (error boundaries, auth)

**Coverage Exclusions:**
- Config files (`*.config.*`, `*.d.ts`)
- Test files (`**/__tests__/**`, `**/*.{test,spec}.*`)
- Build artifacts (`.next/`, `node_modules/`)
- Supabase migrations (`supabase/**`)
- Scripts (`scripts/**`)
- Public assets (`public/**`)

## Build & Deployment

### Docker Build

**Multi-Stage Build** (Alpine Linux, Node 20.19.0):
1. **deps** - Install dependencies with `npm ci`
2. **builder** - Build Next.js app with standalone output
3. **runner** - Final production image (~500MB)

**Key Features:**
- Reproducible builds with `SOURCE_DATE_EPOCH`
- Sentry source maps (build-time only, not in image)
- Service worker compilation fallback (esbuild if Serwist fails)
- Multi-platform support (`linux/amd64`, `linux/arm64`)

**Build Command:**
```bash
DOCKER_BUILDKIT=1 docker build \
  --build-arg APP_COMMIT_SHA=$(git rev-parse HEAD) \
  --build-arg NEXT_PUBLIC_APP_VERSION=$(node -p "require('./package.json').version") \
  -t ghostclass .
```

**Run Container:**
```bash
docker run -p 3000:3000 --env-file .env ghostclass
```

### CI/CD Pipelines

**Workflow Overview:**

1. **pipeline.yml** - Main CI/CD pipeline:
   - Runs on: PR, push to main, merge queue
   - Jobs: `guard` (checkout), `auto-tag` (create version tags)
   - Triggers: `release.yml` via repository_dispatch

2. **test.yml** - Testing pipeline:
   - Runs on: PR, push to main/release branches
   - Jobs: `unit-tests` (Vitest + Codecov), `e2e-tests` (Playwright)
   - Caches: npm dependencies, Playwright browsers

3. **auto-version-bump.yml** - Automatic versioning:
   - Runs on: PR opened/synchronized (same-repo only)
   - Auto-increments version if PR version matches main
   - Commits changes to PR branch
   - **Note:** Fork PRs require manual version bump (bot comments with instructions)

4. **release.yml** - Release workflow:
   - Triggered by: Version tag push (e.g., `v1.7.0`)
   - Builds: Multi-platform Docker images
   - Artifacts: SBOM, attestations, signed tags
   - Deployment: Coolify self-hosted platform
   - SLSA Level 3 compliance

5. **deploy-supabase.yaml** - Database migrations:
   - Triggers on: Changes to `supabase/**` paths
   - Runs: `supabase db push` to apply migrations

**OpenSSF Scorecard Compliance:**
- No `pull_request_target` triggers (security best practice)
- Static checkout refs in split steps
- GPG-signed commits and tags
- SLSA provenance attestations

### Versioning System

**Rollover Versioning** - `X.Y.Z` format:
- **X** = Major (can exceed 9)
- **Y** = Minor (0-9, rolls over to major)
- **Z** = Patch (0-9, rolls over to minor)

**Examples:**
```
1.5.9 → 1.6.0  (patch rollover)
1.9.9 → 2.0.0  (minor + patch rollover)
```

**Automatic Bumping:**
- **Same-repo PRs**: Fully automatic (no action needed)
- **Fork PRs**: Manual bump required (run `npm run bump-version`)

**Version Consistency:**
- `package.json` and `package-lock.json`
- `.example.env` (NEXT_PUBLIC_APP_VERSION)
- `public/api-docs/openapi.yaml` (info.version)

**Verification:**
```bash
npm run verify-version  # Check consistency across files
```

## Security Considerations

### Critical Security Patterns

**1. Environment Variable Validation:**
- Server startup fails if critical vars missing
- Validated in `src/lib/validate-env.ts` (runs in `instrumentation.ts`)
- Required: `ENCRYPTION_KEY`, `CRON_SECRET`, Supabase keys, Redis credentials

**2. Encryption:**
- AES-256-GCM for sensitive data (tokens, credentials)
- Implementation: `src/lib/crypto.ts`
- Key: 64-char hex string (256 bits)

**3. Content Security Policy (CSP):**
- CSP Level 3 with nonce-based script execution
- Hash whitelisting for inline scripts
- Cloudflare Zaraz integration
- GA4 via Measurement Protocol (CSP-compatible)

**4. Rate Limiting:**
- Upstash Redis distributed rate limiting
- Implementation: `src/lib/ratelimit.ts`
- Applied to: API routes, authentication endpoints

**5. Input Validation:**
- Zod schemas for all user input
- Server-side validation with React Hook Form
- Sanitization: `sanitize-html` for user-generated content

**6. External Links:**
- **ALWAYS** include `rel="noopener noreferrer"` for `target="_blank"`
- Use anchor tags (not Next.js `Link`) for external URLs
- Security: Prevents window.opener access

**Example:**
```tsx
// ✅ Good
<Button asChild>
  <a 
    href="https://external.com" 
    target="_blank" 
    rel="noopener noreferrer"
  >
    External Link
  </a>
</Button>

// ❌ Bad - Missing rel attribute
<a href="https://external.com" target="_blank">Link</a>
```

### Security Headers

**Production Headers** (next.config.ts):
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` - HSTS (production only)

### Secrets Management

**Two-Tier Strategy:**

**Tier 1: Build-time (Public)**
- `NEXT_PUBLIC_*` variables - Safe for client exposure
- Bundled into client JavaScript
- Examples: API URLs, site keys, app metadata

**Tier 2: Runtime (Private)**
- Never exposed to client
- Injected at container runtime
- Examples: `ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`

**Critical Rules:**
- **NEVER** commit `.env` files
- **NEVER** log sensitive data
- **ALWAYS** use environment variables for secrets
- Use BuildKit `--mount=type=secret` for Sentry auth token

## Performance Optimization

### Progressive Web App (PWA)

**Serwist Service Worker:**
- Source: `src/sw.ts`
- Output: `public/sw.js` (build artifact, not committed)
- Disabled in dev by default (enable: `NEXT_PUBLIC_ENABLE_SW_IN_DEV="true"`)

**Caching Strategies:**
- **Static Assets** (CSS/JS): StaleWhileRevalidate
- **Images**: CacheFirst (30-day expiration, trusted sources only)
- **API**: NetworkFirst (no timeout, serves cache if network fails)
- **Note**: Only `/api/public/*` and `/api/static/*` cached (user data always fresh)

**Testing PWA Locally:**
```bash
# Enable service worker in dev
NEXT_PUBLIC_ENABLE_SW_IN_DEV="true" npm run dev
```

### React Query Caching

**Default Configuration:**
- Stale time: 3 minutes
- GC time: 10 minutes
- Auto-refetch: 15 minutes
- Refetch on window focus: Disabled

**Profile Data:**
- Stale time: 5 minutes
- GC time: 30 minutes

### Code Splitting

**Automatic:**
- Next.js App Router route-based splitting
- Dynamic imports for heavy components

**Manual:**
- Lazy load Framer Motion: `const { motion } = await import('framer-motion')`
- Lazy load Recharts components when needed

### Bundle Optimization

- Tree-shaking: `lucide-react`, `date-fns`, `framer-motion`
- Console preservation: `log`, `error`, `warn` kept in production
- Font optimization: `display: swap` prevents FOIT
- Image optimization: AVIF/WebP with blur placeholders

## Common Patterns & Best Practices

### Button Component with asChild

**Pattern:** Use `asChild` prop when wrapping interactive elements:

```tsx
import { Button } from '@/components/ui/button';

// ✅ Good - Button renders as anchor (no nested buttons)
<Button asChild>
  <a href="/page">Link</a>
</Button>

// ❌ Bad - Nested interactive elements (accessibility issue)
<Button>
  <a href="/page">Link</a>
</Button>
```

### Attendance Calculation

**Core Algorithm:** `src/lib/logic/bunk.ts`

**Key Functions:**
- `calculateAttendance(present, total, target)` - Main calculation
- Returns: `{ canBunk, requiredToAttend, isExact }`

**Usage in Components:**
- `src/components/attendance/course-card.tsx` - Dual metrics display
- Official data: `realPresent`, `realTotal`, `realAbsent`
- Manual tracking: `extraPresent`, `extraAbsent`, `correctionPresent`

**Business Rule:** Maximum 5 duty leaves (attendance = 225) per course per semester
- Enforced: Database trigger `check_225_attendance_limit()`
- Error: Exception raised if limit exceeded

### Data Normalization

**Pattern:** Return keyed objects (not arrays) from React Query hooks:

```typescript
// ✅ Good - Keyed by course ID
{
  "COURSE-001": { id: "COURSE-001", name: "Math", ... },
  "COURSE-002": { id: "COURSE-002", name: "Physics", ... }
}

// ❌ Bad - Array (harder to look up)
[
  { id: "COURSE-001", name: "Math", ... },
  { id: "COURSE-002", name: "Physics", ... }
]
```

**Benefits:**
- O(1) lookups
- Easy updates
- No array searching

### Error Handling

**Pattern:** Use error boundaries for React components:

```tsx
import { ErrorBoundary } from '@/components/error-boundary';

<ErrorBoundary fallback={<ErrorFallback />}>
  <ComponentThatMightError />
</ErrorBoundary>
```

**Sentry Integration:**
- Auto-capture unhandled errors
- Source maps in production
- Performance monitoring

### Environment-Specific Behavior

**Pattern:** Check `NODE_ENV` or `process.env.NODE_ENV`:

```typescript
// Production-only behavior
if (process.env.NODE_ENV === 'production') {
  // Enable HSTS, strict CSP, etc.
}

// Development-only behavior
if (process.env.NODE_ENV !== 'production') {
  // Disable origin validation, enable verbose logging
}
```

## Anti-Patterns to Avoid

### ❌ Don't Use pull_request_target Trigger

**Why:** Security vulnerability (OpenSSF Scorecard warning)

```yaml
# ❌ Bad
on:
  pull_request_target:
    branches: [main]

# ✅ Good
on:
  pull_request:
    branches: [main]
```

### ❌ Don't Use Dynamic Checkout Refs

**Why:** OpenSSF Scorecard compliance

```yaml
# ❌ Bad
- uses: actions/checkout@v6
  with:
    ref: ${{ github.event.pull_request.head.ref }}

# ✅ Good - Split into separate steps with static refs
- uses: actions/checkout@v6
  if: github.event_name == 'push'
- uses: actions/checkout@v6
  if: github.event_name == 'pull_request'
```

### ❌ Don't Manually Commit Version Bumps

**Why:** Automatic system handles versioning

```bash
# ❌ Bad - Manual version bump (same-repo PRs)
npm run bump-version
git commit -m "Bump version"

# ✅ Good - Let auto-bump workflow handle it
# (Only use manual bump for fork PRs when instructed by bot)
```

### ❌ Don't Skip Type Checking

**Why:** Strict TypeScript mode enforced

```typescript
// ❌ Bad
const value: any = getData();

// ✅ Good
const value: UserData = getData();

// ✅ Acceptable (with justification)
// @ts-expect-error - Legacy API returns incorrect type
const value: UserData = legacyGetData();
```

### ❌ Don't Commit Build Artifacts

**Why:** Generated at build time

```
# ❌ Don't commit
.next/
public/sw.js
coverage/
node_modules/

# ✅ Commit
src/
package.json
Dockerfile
```

### ❌ Don't Use SHA-1 Checksums

**Why:** Security vulnerability (use SHA-256)

```dockerfile
# ❌ Bad
RUN wget npm.tgz && \
    echo "abc123def456 npm.tgz" | sha1sum -c

# ✅ Good
RUN wget npm.tgz && \
    echo "0123456789abcdef... npm.tgz" | sha256sum -c
```

### ❌ Don't Add Custom GPG Config

**Why:** Conflicts with ghaction-import-gpg

```yaml
# ❌ Bad - Conflicts with action's built-in config
- name: Configure GPG
  run: |
    echo "no-tty" >> ~/.gnupg/gpg.conf
    export GPG_TTY=$(tty)

# ✅ Good - Let action handle GPG config
- uses: crazy-max/ghaction-import-gpg@v6.1.0
  with:
    gpg_private_key: ${{ secrets.GPG_PRIVATE_KEY }}
    passphrase: ${{ secrets.GPG_PASSPHRASE }}
```

## Troubleshooting Common Issues

### Issue: Service Worker Not Updating

**Symptoms:** Old service worker cached in browser

**Solution:**
1. Clear browser cache and service workers
2. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. In dev: Disable service worker caching in DevTools
4. Rebuild: `npm run build && npm start`

**Prevention:** Service worker disabled in dev by default

### Issue: Type Errors on Build

**Symptoms:** `npm run build` fails with TypeScript errors

**Solution:**
```bash
# Check types locally
npx tsc --noEmit

# Fix unused variables (use _ prefix)
const _unusedVar = getData();

# Fix implicit any
const value: string = getData();
```

**Prevention:** Run `npm run lint` before committing

### Issue: Tests Failing in CI but Passing Locally

**Symptoms:** E2E tests pass locally but fail in GitHub Actions

**Possible Causes:**
1. Missing environment variables (check test.yml env block)
2. Timing issues (use Playwright's `waitFor` methods)
3. Browser differences (CI uses Chromium only)

**Solution:**
```bash
# Run tests in CI mode locally
CI=true npm run test:e2e

# Check specific browser
npx playwright test --project=chromium
```

### Issue: Docker Build Fails

**Symptoms:** Multi-stage build fails at deps or builder stage

**Common Causes:**
1. Missing build args (APP_COMMIT_SHA, NEXT_PUBLIC_*)
2. npm version mismatch (requires npm 11)
3. Memory limits (increase Docker memory)

**Solution:**
```bash
# Build with all required args
DOCKER_BUILDKIT=1 docker build \
  --build-arg APP_COMMIT_SHA=$(git rev-parse HEAD) \
  --build-arg NEXT_PUBLIC_APP_VERSION=$(node -p "require('./package.json').version") \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -t ghostclass .
```

### Issue: Version Bump Not Triggering Workflows

**Symptoms:** Auto-version-bump commits don't trigger test.yml or pipeline.yml

**Cause:** GitHub prevents workflow loops (commits by GITHUB_TOKEN don't trigger workflows)

**Solution:** Set up `BOT_PAT` secret (maintainers only)
- See: `docs/BOT_PAT_SETUP.md`
- Alternative: Manually re-run workflows after version bump

**Expected Behavior:** This is normal GitHub Actions behavior (not a bug)

### Issue: Playwright Browsers Not Installed

**Symptoms:** E2E tests fail with "Browser not found"

**Solution:**
```bash
# Install Playwright browsers
npx playwright install chromium

# Or install all browsers
npx playwright install
```

**Prevention:** CI caches browsers automatically

### Issue: Environment Variable Not Defined

**Symptoms:** Build fails with "Missing required environment variable"

**Cause:** `src/lib/validate-env.ts` validation failing

**Solution:**
1. Check `.example.env` for required variables
2. Copy to `.env` and populate values
3. For Docker builds, pass via `--env-file .env`

**Critical Variables:**
- `ENCRYPTION_KEY` - 64-char hex string
- `CRON_SECRET` - Any secure string
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `UPSTASH_REDIS_REST_URL` - Upstash Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token

## Documentation & Resources

### Internal Documentation

- **README.md** - Project overview, features, quick start
- **RELEASING.md** - Release process and deployment
- **docs/CONTRIBUTING.md** - Contribution guidelines
- **docs/VERSIONING.md** - Rollover versioning system details
- **docs/BOT_PAT_SETUP.md** - Workflow trigger configuration
- **docs/GPG_SETUP.md** - GPG signing setup for commits/tags
- **docs/COSIGN_VERIFICATION.md** - Verifying Docker image signatures
- **docs/EZYGO_RATE_LIMITING.md** - EzyGo API rate limiting details
- **docs/BUILD_PERFORMANCE.md** - Build optimization strategies

### API Documentation

- **Location:** `public/api-docs/openapi.yaml`
- **Viewer:** `/api-docs` route (Scalar interactive docs)
- **Validation:** `npm run docs:validate` (Redocly CLI)

### External Resources

- **Next.js 16 Docs:** https://nextjs.org/docs
- **React 19 Docs:** https://react.dev
- **Tailwind CSS 4:** https://tailwindcss.com
- **Radix UI:** https://www.radix-ui.com
- **TanStack Query:** https://tanstack.com/query
- **Vitest:** https://vitest.dev
- **Playwright:** https://playwright.dev
- **Supabase:** https://supabase.com/docs

## Quick Reference: Most Common Tasks

### Creating a New Component

```bash
# 1. Create component file
touch src/components/feature/my-component.tsx

# 2. Write component
# Use TypeScript, proper types, export default

# 3. Create test file
touch src/components/feature/__tests__/my-component.test.tsx

# 4. Write tests
# Use Vitest + React Testing Library

# 5. Run tests
npm test
```

### Adding a New API Route

```bash
# 1. Create route file
touch src/app/api/my-route/route.ts

# 2. Implement handler
# Export GET, POST, etc. functions

# 3. Update OpenAPI spec (if public API)
vim public/api-docs/openapi.yaml

# 4. Validate spec
npm run docs:validate

# 5. Test manually
npm run dev
curl http://localhost:3000/api/my-route
```

### Adding a Database Migration

```bash
# 1. Create migration file
npx supabase migration new add_feature

# 2. Write SQL migration
vim supabase/migrations/<timestamp>_add_feature.sql

# 3. Test locally (if using local Supabase)
npx supabase db reset

# 4. Push to remote
npx supabase db push

# 5. Verify in Supabase dashboard
```

### Fixing a Linting Issue

```bash
# 1. Run linter
npm run lint

# 2. Auto-fix (if possible)
npm run lint

# 3. Manual fixes for remaining issues
# - Add types for implicit any
# - Prefix unused vars with _
# - Fix React Hook dependencies

# 4. Verify
npm run lint
```

### Running Full Pre-PR Checklist

```bash
# 1. Lint and fix
npm run lint

# 2. Type check
npx tsc --noEmit

# 3. Run unit tests
npm test

# 4. Check coverage
npm run test:coverage

# 5. Run E2E tests
npm run test:e2e

# 6. Build production
npm run build

# 7. Create PR
git push origin feature/my-feature
# Version bump happens automatically for same-repo PRs
```

## Notes for AI Coding Agents

### Working Efficiently

1. **Read existing code first** - Understand patterns before making changes
2. **Use path aliases** - Always import with `@/*` prefix
3. **Follow TypeScript strict mode** - No implicit any, proper types
4. **Run tests frequently** - Catch issues early
5. **Keep changes focused** - One feature/fix per PR
6. **Update tests** - Modify tests alongside code changes
7. **Check documentation** - Update docs if behavior changes
8. **Verify builds** - Always run `npm run build` before finalizing

### Testing Strategy

1. **Unit tests first** - Test logic in isolation
2. **Component tests next** - Test UI behavior
3. **E2E tests last** - Test full user flows
4. **Coverage is important** - Maintain minimum 10% threshold
5. **Test edge cases** - Consider boundary conditions

### Security Mindset

1. **Never commit secrets** - Use environment variables
2. **Validate all input** - Use Zod schemas
3. **Sanitize user content** - Use `sanitize-html`
4. **Check external links** - Include `rel="noopener noreferrer"`
5. **Use encryption** - AES-256-GCM for sensitive data
6. **Rate limit APIs** - Use Upstash Redis rate limiting

### Performance Considerations

1. **Lazy load heavy components** - Use dynamic imports
2. **Optimize images** - Use Next.js Image with blur placeholders
3. **Cache appropriately** - React Query for server state, LRU for API responses
4. **Code split wisely** - App Router handles most automatically
5. **Monitor bundle size** - Tree-shake imports

### When in Doubt

1. **Check existing code** - Look for similar patterns
2. **Read documentation** - Check README, CONTRIBUTING, etc.
3. **Run tests** - Verify expected behavior
4. **Ask for clarification** - Better to ask than assume
5. **Start small** - Make minimal changes first

## Summary

GhostClass is a **production-grade, security-focused, performance-optimized** application with comprehensive testing, strict type checking, and automated versioning. Follow these instructions to maintain code quality, security standards, and consistency across the codebase.

**Key Takeaways:**
- ✅ Use TypeScript strict mode (no implicit any)
- ✅ Follow Shadcn UI patterns (asChild, cn utility)
- ✅ Test comprehensively (unit + E2E)
- ✅ Secure by default (encryption, CSP, rate limiting)
- ✅ Version automatically (same-repo PRs)
- ✅ Optimize performance (PWA, caching, code splitting)
- ✅ Document changes (update README, API docs)

**Before Every PR:**
```bash
npm run lint && npm test && npm run build
```

Happy coding! 🚀
