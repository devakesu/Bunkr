# Security Enhancements - Implementation Guide

## Overview
This document describes the CSRF token protection and request signing implementations added to GhostClass.

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
- Constant-time comparison prevents timing attacks
- HttpOnly cookies prevent XSS token theft
- SameSite=lax provides additional CSRF protection
- 1-hour TTL limits exposure window
- Automatic cleanup on logout

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
