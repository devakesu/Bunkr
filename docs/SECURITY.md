# Security Enhancements - Implementation Guide

## Overview
This document describes the security implementations in GhostClass, including CSRF token protection, multi-device authentication, request signing, and encryption patterns.

## Multi-Device Authentication

### Purpose
Enables users to login from multiple devices simultaneously without invalidating existing sessions. Uses canonical password pattern with encrypted storage for secure, persistent authentication across devices.

### Implementation Files
- **API Route**: `src/app/api/auth/save-token/route.ts` - Authentication handler
- **Library**: `src/lib/crypto.ts` - AES-256-GCM encryption utilities
- **Database Migration**: `supabase/migrations/20260203_add_auth_password_column.sql` - Schema update

### How It Works

**Canonical Password Pattern:**

1. **First Login (New User)**
   ```typescript
   // Generate canonical password (one-time only)
   const canonicalPassword = crypto.randomBytes(32).toString('hex');
   
   // Create Supabase Auth user with canonical password
   await supabaseAdmin.auth.admin.createUser({
     email,
     password: canonicalPassword,
     email_confirm: true,
   });
   
   // Encrypt and store password in database
   const { iv, content } = encrypt(canonicalPassword);
   await supabaseAdmin.from("users").upsert({
     auth_password: content,
     auth_password_iv: iv,
   });
   ```

2. **Subsequent Logins (Existing User)**
   ```typescript
   // Retrieve encrypted password from database
   const { data } = await supabaseAdmin
     .from("users")
     .select("auth_password, auth_password_iv")
     .eq("id", userId)
     .single();
   
   // Decrypt canonical password
   const canonicalPassword = decrypt(data.auth_password_iv, data.auth_password);
   
   // Sign in with decrypted password (does NOT update password)
   await supabase.auth.signInWithPassword({
     email,
     password: canonicalPassword,
   });
   ```

### Database Schema

```sql
-- Users table additions
ALTER TABLE users ADD COLUMN auth_password TEXT;
ALTER TABLE users ADD COLUMN auth_password_iv TEXT;

-- Integrity constraints
ALTER TABLE users ADD CONSTRAINT check_auth_password_consistency 
CHECK ((auth_password IS NULL AND auth_password_iv IS NULL) 
    OR (auth_password IS NOT NULL AND auth_password_iv IS NOT NULL));

ALTER TABLE users ADD CONSTRAINT check_auth_password_not_empty 
CHECK (auth_password IS NULL OR auth_password != '');

ALTER TABLE users ADD CONSTRAINT check_auth_password_iv_not_empty 
CHECK (auth_password_iv IS NULL OR auth_password_iv != '');
```

### Security Features

**Encryption:**
- Algorithm: AES-256-GCM (authenticated encryption)
- Key derivation: Uses `ENCRYPTION_KEY` environment variable
- IV storage: Separate column (`auth_password_iv`) for decryption
- Same pattern as EzyGo token encryption for consistency

**Session Isolation:**
- Each device maintains independent session cookies
- Logout on one device does NOT invalidate other sessions
- Password never changes after first login (prevents session invalidation)
- Device sessions tracked separately in Redis (future enhancement)

**Error Handling:**
- Encryption failures logged to Sentry with `password_encryption_failure` tag
- Decryption failures logged with `password_decryption_failure` tag
- Retrieval failures logged with `password_retrieval_failure` tag
- Generic error messages to users (no sensitive info disclosure)

**Best Practices:**
- ✅ Canonical password generated once, never regenerated
- ✅ Passwords encrypted before storage, never stored in plaintext
- ✅ IV stored separately for proper AES-GCM decryption
- ✅ Database constraints enforce data integrity
- ✅ Comprehensive error monitoring with Sentry
- ✅ Constant-time operations prevent timing attacks

### Why Canonical Password Pattern?

**Previous Issue:**
Each login regenerated an ephemeral password and updated the Supabase user's password. This invalidated all previous sessions when a user logged in from a new device.

**Solution:**
Canonical password pattern generates one password on first login and reuses it for all subsequent logins. This allows multiple concurrent sessions from different devices without invalidation.

**Trade-offs:**
- ✅ Multi-device support without session conflicts
- ✅ Better user experience (no unexpected logouts)
- ✅ Reduced password churn (fewer database updates)
- ⚠️ Requires secure encryption and key management
- ⚠️ Password persists in database (encrypted) vs ephemeral in memory

---

## CSRF Token Protection

### Purpose
Prevents Cross-Site Request Forgery attacks by validating that requests originate from legitimate forms.

### Implementation Files
- **Library**: `src/lib/csrf.ts`
- **Protected Routes**:
  - `/api/auth/save-token` (Login)
  - `/api/logout` (Logout)

### How It Works

1. **Token Generation** (Server-side)
   ```typescript
   import { initializeCsrfToken } from "@/lib/csrf";
   
   // In page component
   const csrfToken = await initializeCsrfToken();
   ```

2. **Token Storage**
   - Stored in HttpOnly cookie: `gc_csrf_token`
   - Expires after 1 hour
   - Secure flag enabled in production

3. **Token Validation** (API routes)
   ```typescript
   import { validateCsrfToken } from "@/lib/csrf";
   
   export async function POST(req: Request) {
     const isValid = await validateCsrfToken(req);
     if (!isValid) {
       return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
     }
     // ... rest of handler
   }
   ```

4. **Client-side Usage**
   ```typescript
   import { CSRF_HEADER } from "@/lib/csrf";
   
   const headers: Record<string, string> = {
     "Content-Type": "application/json",
   };
   
   if (csrfToken) {
     headers[CSRF_HEADER] = csrfToken;
   }
   
   await axios.post("/api/protected-route", data, { headers });
   ```

### Security Features

**Double-Submit CSRF Pattern:**
- Uses BOTH cookie and custom header validation for protection
- Cookie is intentionally NOT HttpOnly (required for double-submit pattern)
- Client JavaScript reads cookie value and sends it in custom header
- Cross-site requests cannot include the cookie due to same-origin policy (cookie domain/path scoping)

**XSS Protection (Critical Dependency):**
- Content Security Policy (CSP) with nonce-based script execution in production
- React's built-in escaping prevents injection attacks
- Regular security audits and dependency updates
- Without XSS prevention, CSRF protection can be bypassed

**Additional Safeguards:**
- Constant-time comparison prevents timing attacks
- SameSite=Lax restricts when cookies are sent on cross-site requests (cookies not sent on most cross-site subresource requests, but still sent on top-level navigations)
- 1-hour TTL limits exposure window
- Automatic cleanup on logout
- Secure flag enabled in production (HTTPS only)

---

## Content Security Policy (CSP)

### Purpose
Prevents Cross-Site Scripting (XSS) attacks by controlling which resources can be loaded and executed in the browser.

### Implementation Files
- **Library**: `src/lib/csp.ts` - CSP header generation with nonces and hashes
- **Middleware**: `src/proxy.ts` - CSP header injection for all requests
- **Layout**: `src/app/layout.tsx` - Nonce attributes on scripts/styles

### CSP Architecture

GhostClass implements **CSP Level 3** with nonce-based execution and hash whitelisting:

1. **Nonce-Based Scripts** (`script-src`, `script-src-elem`)
   - Unique nonce generated per request in middleware
   - All Next.js scripts include the nonce attribute
   - `'strict-dynamic'` allows nonce'd scripts to load other scripts
   - Host-based fallback for older browsers

2. **Hash-Based Styles** (`style-src-elem`)
   - Static hashes for library-injected CSS (Sonner, Recharts, Framer Motion)
   - Nonce for dynamically generated styles
   - Prevents inline style injection attacks

3. **Cloudflare Zaraz Integration**
   - Zaraz automatically injects its own nonce for inline scripts
   - Pattern detection: When CSP contains `'nonce-*'` + `'unsafe-inline'`, Zaraz appends its nonce
   - CSP3 browsers ignore `'unsafe-inline'` when nonces present (defense-in-depth)
   - See [Zaraz CSP documentation](https://blog.cloudflare.com/zaraz-supports-csp/)

### Configuration

**Development Mode:**
```typescript
// Relaxed CSP for hot reload and debugging
script-src: 'self' 'unsafe-inline' 'unsafe-eval'
style-src: 'self' 'unsafe-inline'
```

**Production Mode:**
```typescript
// Strict nonce + hash-based CSP
script-src: 'self' 'nonce-RANDOM' 'strict-dynamic'
script-src-elem: 'self' 'nonce-RANDOM' 'unsafe-inline' [host sources]
style-src-elem: 'self' 'nonce-RANDOM' [hashes for libraries]
```

### Adding New Style Hashes

When adding libraries that inject inline styles:

1. **Identify CSP violation** in browser console:
   ```
   Refused to apply inline style because it violates CSP directive
   Note: sha256-ABC123...
   ```

2. **Calculate hash manually** (alternative):
   ```bash
   echo -n "CSS_CONTENT" | openssl dgst -sha256 -binary | openssl base64 -A
   ```

3. **Add to whitelist** in [src/lib/csp.ts](src/lib/csp.ts):
   ```typescript
   const styleSrcElemParts = [
     // ... existing hashes
     "'sha256-YOUR_HASH_HERE='", // Library name and purpose
   ];
   ```

### Troubleshooting

**Symptom**: Scripts/styles blocked by CSP
- Check browser console for CSP violation reports
- Verify nonce is present on all `<script>` and `<style>` tags
- Ensure middleware is generating unique nonces per request

**Symptom**: Cloudflare scripts blocked
- Verify `'unsafe-inline'` appears AFTER nonce in `script-src-elem`
- Check that Cloudflare Zaraz is enabled in dashboard
- Review [Zaraz CSP integration docs](https://blog.cloudflare.com/zaraz-supports-csp/)

**Symptom**: Third-party scripts fail to load
- Add host to `script-src-elem` (not `script-src` with `strict-dynamic`)
- Verify script doesn't inject additional inline scripts

### Server-Side Analytics

To avoid CSP issues with Google Analytics, we use **GA4 Measurement Protocol** for server-side tracking:

**Benefits:**
- ✅ No CSP violations (no client-side gtag.js script)
- ✅ Better privacy (server-side tracking)
- ✅ Ad-blocker resistant
- ✅ Full GA4 feature parity
- ✅ Rate-limited API endpoint (default 60 events/min per IP, configurable via environment variables)

**Implementation:**
- Client: `<AnalyticsTracker />` component tracks events automatically
- API: `/api/analytics/track` endpoint forwards events to GA4 Measurement Protocol
- Library: `src/lib/analytics.ts` handles GA4 API communication
- Configuration: `GA_API_SECRET` environment variable (server-only)

**Auto-tracked events (matching gtag.js enhanced measurement):**
- ✅ **Page views** - Route changes via Next.js router
- ✅ **Scroll depth** - 25%, 50%, 75%, 90% thresholds
- ✅ **Outbound link clicks** - External domain navigation
- ✅ **File downloads** - PDF, ZIP, DOC, XLS, etc.
- ✅ **Form interactions** - Form start and submit events
- ✅ **Video engagement** - Play, pause, progress, complete

**Manual tracking:**
```typescript
import { trackEvent } from "@/components/analytics-tracker";

// Custom events
await trackEvent("button_click", { button_name: "signup" });
await trackEvent("purchase", { value: 99.99, currency: "USD" });
```

**Setup:**
1. Get GA4 API Secret from Google Analytics (Admin → Data Streams → Measurement Protocol API secrets)
2. Set `GA_API_SECRET` environment variable (never commit to repo)
3. Verify events in GA4 Realtime reports (appears within 60 seconds)

---

## Request Signing

### Purpose
Ensures request authenticity and prevents replay attacks for sensitive operations.

### Implementation Files
- **Library**: `src/lib/request-signing.ts`
- **Use Cases**: Sensitive API calls requiring additional verification

### How It Works

1. **Signing Requests** (Server Actions)
   ```typescript
   import { generateSignedHeaders } from "@/lib/request-signing";
   
   const payload = JSON.stringify(data);
   const signedHeaders = generateSignedHeaders(payload);
   
   await fetch("/api/sensitive-endpoint", {
     method: "POST",
     body: payload,
     headers: {
       "Content-Type": "application/json",
       ...signedHeaders
     }
   });
   ```

2. **Validating Signatures** (API routes)
   ```typescript
   import { validateSignedRequest } from "@/lib/request-signing";
   
   export async function POST(req: Request) {
     const isValid = await validateSignedRequest(req);
     if (!isValid) {
       return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
     }
     // ... rest of handler
   }
   ```

### Request Headers
- `x-signature`: HMAC-SHA256 signature of request
- `x-timestamp`: Unix timestamp (seconds)

### Security Features
- HMAC-SHA256 ensures cryptographic integrity
- Timestamp validation prevents replay attacks (5-minute window)
- Constant-time comparison prevents timing attacks
- Uses `ENCRYPTION_KEY` environment variable as secret
- Rejects future-dated requests

---

## Adding Protection to New Endpoints

### For CSRF Protection

**Step 1**: Add validation to route handler
```typescript
import { validateCsrfToken } from "@/lib/csrf";

export async function POST(req: Request) {
  // Add CSRF check at the beginning
  const csrfValid = await validateCsrfToken(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  
  // Your existing handler code...
}
```

**Step 2**: Generate token in the page that renders the form
```typescript
import { initializeCsrfToken } from "@/lib/csrf";

export default async function YourPage() {
  const csrfToken = await initializeCsrfToken();
  return <YourForm csrfToken={csrfToken} />;
}
```

**Step 3**: Send token from client component
```typescript
import { CSRF_HEADER } from "@/lib/csrf";

const headers = { [CSRF_HEADER]: csrfToken };
await axios.post("/api/your-endpoint", data, { headers });
```

### For Request Signing

**Step 1**: Add validation to API route
```typescript
import { validateSignedRequest } from "@/lib/request-signing";

export async function POST(req: Request) {
  const isValid = await validateSignedRequest(req);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }
  
  // Your handler code...
}
```

**Step 2**: Sign requests in Server Actions
```typescript
import { generateSignedHeaders } from "@/lib/request-signing";

const payload = JSON.stringify(requestData);
const signedHeaders = generateSignedHeaders(payload);

await fetch("/api/sensitive-route", {
  method: "POST",
  body: payload,
  headers: { "Content-Type": "application/json", ...signedHeaders }
});
```

---

## Best Practices

### When to Use CSRF Protection
- ✅ State-changing operations (POST, PUT, DELETE)
- ✅ Authentication/authorization endpoints
- ✅ User data modification
- ❌ GET requests (read-only)
- ❌ Public APIs with other auth mechanisms

### When to Use Request Signing
- ✅ Highly sensitive operations (payment, account deletion)
- ✅ Admin-only endpoints
- ✅ Webhook receivers
- ✅ Inter-service communication
- ❌ Public read endpoints
- ❌ Already-authenticated user actions (redundant)

### Combining Both
For maximum security on critical endpoints:
```typescript
export async function POST(req: Request) {
  // 1. CSRF protection
  const csrfValid = await validateCsrfToken(req);
  if (!csrfValid) return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  
  // 2. Request signing
  const signatureValid = await validateSignedRequest(req);
  if (!signatureValid) return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  
  // 3. Rate limiting
  // 4. Authentication
  // 5. Business logic
}
```

---

## Testing

### CSRF Token Testing
```typescript
// Should fail without token
const response = await fetch("/api/protected", {
  method: "POST",
  body: JSON.stringify(data)
});
expect(response.status).toBe(403);

// Should succeed with valid token
const responseWithToken = await fetch("/api/protected", {
  method: "POST",
  headers: { "x-csrf-token": validToken },
  body: JSON.stringify(data)
});
expect(responseWithToken.status).toBe(200);
```

### Request Signing Testing
```typescript
// Should fail with invalid signature
const response = await fetch("/api/signed", {
  method: "POST",
  headers: {
    "x-signature": "invalid",
    "x-timestamp": Date.now().toString()
  },
  body: JSON.stringify(data)
});
expect(response.status).toBe(403);

// Should fail with old timestamp (replay attack)
const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
const signature = signRequest(JSON.stringify(data), oldTimestamp);
const oldResponse = await fetch("/api/signed", {
  method: "POST",
  headers: {
    "x-signature": signature,
    "x-timestamp": oldTimestamp.toString()
  },
  body: JSON.stringify(data)
});
expect(oldResponse.status).toBe(403);
```

---

## Security Considerations

### CSRF Tokens
- ✅ HttpOnly cookies prevent XSS theft
- ✅ Short TTL limits exposure
- ✅ Constant-time comparison prevents timing attacks
- ⚠️ Tokens invalidated on logout
- ⚠️ HTTPS required in production

### Request Signing
- ✅ Cryptographic integrity with HMAC-SHA256
- ✅ Timestamp prevents replay attacks
- ✅ Uses existing ENCRYPTION_KEY secret
- ⚠️ 5-minute window balances security vs clock skew
- ⚠️ Requires synchronized clocks for distributed systems

### Combined Defense Layers
1. **Origin validation** (already implemented)
2. **CSRF tokens** (new)
3. **Request signing** (new)
4. **Rate limiting** (already implemented)
5. **Authentication** (already implemented)
6. **Input validation** (already implemented)

---

## Environment Variables

No new environment variables required! Uses existing:
- `ENCRYPTION_KEY` - Used for request signing secret
- `NODE_ENV` - Controls secure cookie flags

---

## Migration Notes

### Existing Users
- CSRF tokens auto-generated on next login
- No database migrations required
- Backward compatible (degrades gracefully)

### Development vs Production
- Development: Secure cookies disabled for HTTP
- Production: Secure cookies enforced
- Both: Same security validation logic

---

## Troubleshooting

### "Invalid CSRF token" Error
1. Check if CSRF token is being passed in headers
2. Verify token cookie exists (`gc_csrf_token`)
3. Ensure token hasn't expired (1-hour TTL)
4. Check for cookie domain/path issues
5. Verify SameSite cookie settings

### "Invalid signature" Error
1. Verify payload hasn't been modified
2. Check timestamp is current (within 5 minutes)
3. Ensure ENCRYPTION_KEY is consistent
4. Verify header names match (`x-signature`, `x-timestamp`)
5. Check for JSON stringification differences

---

## Future Enhancements

### Potential Improvements
- [ ] Per-user CSRF tokens (currently global)
- [ ] Nonce-based replay prevention
- [ ] Configurable signing window
- [ ] Request signing for webhooks
- [ ] Audit logging for failed validations
- [ ] Rate limiting for invalid tokens/signatures

### Monitoring
Consider adding metrics for:
- CSRF validation failure rate
- Signature validation failure rate
- Replay attack attempts
- Token expiration patterns

---

## Container Deployment Security

### Network Binding Configuration

The application container uses the `HOSTNAME` environment variable to control which network interfaces the Next.js server binds to. This is a critical security configuration when deploying in containers.

#### Default Configuration (0.0.0.0)

The default binding of `0.0.0.0` allows the container to accept connections from other containers in the same network. This is the **most common deployment pattern** when using a separate reverse proxy container.

**Build with default binding:**
```dockerfile
docker build -t ghostclass .
```

**Override at build time:**
```dockerfile
docker build --build-arg NEXT_HOSTNAME=127.0.0.1 -t ghostclass .
```

#### Deployment Patterns

**1. Separate Container Reverse Proxy (RECOMMENDED)**
- **Binding:** Use default `0.0.0.0`
- **Use case:** Reverse proxy (nginx, traefik, Envoy) runs in separate container/pod
- **Security:** Network isolation provided by container network policies and firewall rules
- **Example:** Kubernetes pods, Docker Compose with separate nginx container

**2. Same-Host Reverse Proxy**
- **Binding:** Use `--build-arg NEXT_HOSTNAME=127.0.0.1`
- **Use case:** Reverse proxy runs on same host (not containerized)
- **Security:** More restrictive binding, application only accessible via localhost
- **Example:** nginx on host machine with app in container

#### ⚠️ Critical Security Requirements (0.0.0.0 binding)

When using the default `0.0.0.0` binding, you **MUST** ensure:

1. **Reverse Proxy Required** - Container must run strictly behind a reverse proxy, firewall, or service mesh
2. **No Direct Access** - Block direct container access (no NodePort, HostPort, or direct Docker port mapping)
3. **Network Policies** - Configure network policies to restrict which services can reach the container
4. **Proxy-Only Access** - Only the reverse proxy should be able to connect to the container

#### Deployment Validation Checklist

Before deploying to production, verify:

- ✅ Reverse proxy/load balancer is correctly configured
- ✅ Direct container access is blocked at the network level
- ✅ Only reverse proxy can reach the container (test with network tools)
- ✅ Container network policies and firewall rules are reviewed
- ✅ These checks are enforced in CI/CD pipelines

#### Security Best Practices

1. **Never expose the container directly** to the public internet
2. **Always use a reverse proxy** with proper security headers, rate limiting, and SSL/TLS termination
3. **Implement network segmentation** to isolate the application container
4. **Monitor network traffic** to detect unauthorized access attempts
5. **Regular security audits** of your container deployment configuration

#### Common Misconfigurations

❌ **AVOID:**
- Exposing container ports directly with `docker run -p 3000:3000` without a reverse proxy
- Using NodePort in Kubernetes without network policies
- Mapping host ports directly to container in production

✅ **CORRECT:**
- Using an ingress controller in Kubernetes
- Docker Compose with nginx proxy in separate container
- Cloud load balancer → reverse proxy → application container

---

## Testing Security Features

### Test Coverage Strategy

Security-critical code paths should have comprehensive test coverage to prevent regressions and ensure proper functionality. The following components have dedicated test suites:

#### Current Test Coverage

1. **CSRF Protection** (`src/lib/security/__tests__/csrf.test.ts`)
   - ✅ 32 test cases covering:
     - Token generation and validation
     - Header and cookie token extraction
     - Whitespace handling edge cases
     - Timing attack prevention
     - Token lifecycle (initialization, refresh, cleanup)
     - Cookie security settings

2. **Request Signing** (`src/lib/security/__tests__/request-signing.test.ts`)
   - ✅ 33 test cases covering:
     - Signature generation and verification
     - Timestamp validation and replay attack prevention
     - Signature tampering detection
     - Header validation
     - Edge cases and error handling

#### Critical Security Test Scenarios

The following scenarios must be tested for all security features:

**CSRF Protection:**
- ✓ Valid token validation succeeds
- ✓ Missing token validation fails
- ✓ Mismatched header/cookie validation fails
- ✓ Expired token validation fails
- ✓ Token with whitespace is rejected
- ✓ Replay attacks are prevented

**Origin Validation:**
- ✓ Requests from allowed origins succeed
- ✓ Requests from disallowed origins fail
- ✓ Missing Origin header fails
- ✓ Malformed Origin header fails
- ✓ Query parameters and fragments don't bypass validation

**IP Extraction:**
- ✓ Valid IP headers are extracted correctly
- ✓ Missing IP headers return null (production) or localhost (dev)
- ✓ Malformed IP addresses are handled gracefully

**Request Signing:**
- ✓ Valid signatures are accepted
- ✓ Invalid signatures are rejected
- ✓ Timestamp validation prevents replay attacks
- ✓ Signature tampering is detected

#### Running Security Tests

```bash
# Run all security tests
npm test -- src/lib/security/

# Run with coverage report
npm run test:coverage -- src/lib/security/

# Watch mode for development
npm run test:watch -- src/lib/security/
```

#### Coverage Thresholds

Current project-wide coverage thresholds are set at 10% to allow for initial development. However, security-critical modules should maintain higher coverage:

**Recommended coverage for security modules:**
- Lines: ≥80%
- Functions: ≥80%
- Branches: ≥75%
- Statements: ≥80%

#### Adding New Security Features

When adding new security features, follow this testing checklist:

1. **Create test file** in `src/lib/security/__tests__/`
2. **Test all edge cases** including:
   - Valid inputs with expected behavior
   - Invalid inputs with proper error handling
   - Boundary conditions (empty strings, null, undefined)
   - Attack vectors (injection, bypass attempts, replay)
3. **Mock external dependencies** (cookies, headers, crypto)
4. **Document test scenarios** with clear descriptions
5. **Verify no false positives** that could block legitimate users
6. **Run full test suite** before committing

#### Continuous Security Testing (Recommended Practices)

- **Pre-commit checks (recommended):** Run security-related tests locally before committing (for example, via Husky or other Git hooks)
- **CI/CD pipeline (recommended):** Configure your pipeline to fail if security tests fail
- **Static analysis (optional but recommended):** Integrate a tool such as GitHub CodeQL or similar into CI for automated vulnerability detection
- **Dependency audits (recommended):** Run `npm audit` regularly (manually or in CI) and address high/critical findings
- **Manual security reviews:** Perform a focused security review before each major release

---

## Dependency Security

### Package Overrides for Security Patches

The project uses npm's `overrides` feature in `package.json` to enforce secure versions of transitive dependencies. This ensures that all packages, including those not directly listed in `dependencies`, use patched versions that address known security vulnerabilities.

#### Current Security Overrides

The following package overrides are in place as defense-in-depth measures to ensure we use maintained versions that receive security fixes:

1. **fast-xml-parser: ^5.3.4**
   - **Reason:** Ensures we use a maintained version of fast-xml-parser that receives security fixes
   - **CVE / Advisory:** No specific CVE is currently being targeted. This is a proactive hardening measure.
   - **Severity:** None known (defense-in-depth / hardening upgrade)
   - **Impact:** Non-breaking semver-compatible update for our dependencies
   - **Validation:** Changes have been validated by running the full test suite and `npm audit` shows no vulnerabilities
   - **Type:** Transitive dependency override (brought in by other packages)
   - **Tracking:** Any future vulnerabilities will be tracked in GitHub issues with the `fast-xml-parser` label

2. **js-yaml: ^4.1.1**
   - **Reason:** Ensures we use a maintained version of js-yaml that receives security fixes
   - **CVE / Advisory:** No specific CVE is currently being targeted. This is a proactive hardening measure.
   - **Severity:** None known (defense-in-depth / hardening upgrade)
   - **Impact:** Non-breaking semver-compatible update for our dependencies
   - **Validation:** Changes have been validated by running the full test suite and `npm audit` shows no vulnerabilities
   - **Type:** Transitive dependency override (brought in by other packages)
   - **Tracking:** Any future vulnerabilities will be tracked in GitHub issues with the `js-yaml` label

3. **tar: ^7.5.6**
   - **Reason:** Ensures we use a maintained version of tar that receives security fixes
   - **CVE / Advisory:** No specific CVE is currently being targeted. This is a proactive hardening measure.
   - **Severity:** None known (defense-in-depth / hardening upgrade)
   - **Impact:** Non-breaking semver-compatible update for our dependencies
   - **Validation:** Changes have been validated by running the full test suite and `npm audit` shows no vulnerabilities
   - **Type:** Transitive dependency override (brought in by other packages)
   - **Tracking:** Any future vulnerabilities will be tracked in GitHub issues with the `tar` label

4. **glob: ^11.0.0**
   - **Reason:** Upgrades all instances of glob to the latest major version (v11) to ensure security fixes and remove deprecated dependencies
   - **CVE / Advisory:** No specific CVE, but older glob versions (v7, v10) depend on deprecated packages like `inflight`
   - **Severity:** Low (proactive upgrade to maintained version)
   - **Impact:** Major version upgrade with API compatibility for most consumers; validated across our dependency tree. This upgrade successfully removes deprecated dependencies including `inflight`, `once`, `wrappy`, `fs.realpath`, and `path-is-absolute` from the dependency tree.
   - **Validation:** Changes have been validated by running the full test suite and `npm audit` shows no vulnerabilities
   - **Type:** Transitive dependency override (brought in by various build tools and packages)
   - **Tracking:** Any future vulnerabilities will be tracked in GitHub issues with the `glob` label

**Verification:** Run `npm audit` to verify no known vulnerabilities exist in the current dependency tree.

#### Maintenance Process

When adding or updating dependency overrides:

1. **Document the CVE or security advisory** being addressed
2. **Create a tracking issue** to monitor when the override can be removed (once direct dependencies naturally upgrade)
3. **Verify compatibility** by running the full test suite (`npm run test:all`)
4. **Monitor for updates** and remove overrides when they're no longer needed
5. **Review periodically** to ensure overrides are still necessary and up-to-date

#### Checking for Security Updates

Run these commands regularly to identify security issues:

```bash
# Check for known vulnerabilities
npm audit

# Check for available updates
npm outdated

# Update dependencies safely
npm update

# Review and apply security fixes
npm audit fix
```

#### Best Practices

- ✅ Keep overrides up-to-date with the latest secure versions
- ✅ Remove overrides once direct dependencies have been updated
- ✅ Document the reason for each override
- ✅ Test thoroughly after adding or updating overrides
- ✅ Use `npm audit` regularly to identify new vulnerabilities
- ⚠️ Be cautious with major version overrides (may introduce breaking changes)
- ⚠️ Monitor for conflicts between overridden and direct dependencies
