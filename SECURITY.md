# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in GhostClass, please report it responsibly:

**Email**: [admin@ghostclass.devakesu.com](mailto:admin@ghostclass.devakesu.com)

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

We take security seriously and will respond to reports as quickly as possible.

## Security Features

GhostClass implements multiple layers of security:

### Authentication & Authorization
- **Supabase Auth** - Industry-standard authentication with JWT tokens
- **Row Level Security (RLS)** - Database-level access control ensuring users only access their data
- **Session Management** - Secure session handling with automatic expiration

### Data Protection
- **HttpOnly Cookies** - Sensitive tokens stored in secure, HttpOnly cookies
- **Secure Headers** - HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **Input Validation** - Zod schemas validate all user input
- **Origin Validation** - Strict origin checking in production

### API Security
- **Rate Limiting** - EzyGo API batch fetcher with request deduplication and circuit breaker
- **Circuit Breaker Pattern** - Graceful handling of upstream failures
- **Request Deduplication** - Prevents duplicate concurrent requests
- **Bot Protection** - Cloudflare Turnstile on public endpoints

### Environment Security
- **Environment Variable Validation** - Runtime validation of required secrets
- **Two-Tier Secret Management** - Separate build-time and runtime secrets
- **Production Safety Checks** - Strict validation in production mode

## Deployment Security Checklist

Before deploying to production:

- [ ] All required environment variables are set
- [ ] Database RLS policies are enabled
- [ ] Secure headers are configured
- [ ] Origin validation is enabled
- [ ] Rate limiting is configured
- [ ] Circuit breaker thresholds are appropriate
- [ ] Logging is configured for security events
- [ ] Cloudflare Turnstile is enabled
- [ ] HTTPS is enforced
- [ ] Security monitoring is in place

For detailed deployment patterns and configuration, refer to the documentation in the `docs/` directory.
