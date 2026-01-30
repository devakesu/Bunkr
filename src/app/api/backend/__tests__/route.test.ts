import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

// Set up environment before any imports
// Note: NEXT_PUBLIC_APP_DOMAIN is already set to 'localhost' in vitest.setup.ts
// and the route module caches allowed hosts on first import, so we use 'localhost' here
beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.example.com');
});

// Mock the security modules before importing
vi.mock('@/lib/security/auth-cookie', () => ({
  getAuthTokenServer: vi.fn(() => Promise.resolve('mock-token')),
}));

vi.mock('@/lib/security/csrf', () => ({
  validateCsrfToken: vi.fn(() => Promise.resolve(true)),
}));

// Mock fetch for upstream API calls
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Backend Proxy Route', () => {
  type ForwardHandler = typeof import('../[...path]/route')['forward'];
  let forward: ForwardHandler;

  beforeAll(async () => {
    // Import after mocks are set up
    const routeModule = await import('../[...path]/route');
    forward = routeModule.forward;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CSRF Protection', () => {
    it('should enforce CSRF validation for POST requests', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf');
      vi.mocked(validateCsrfToken).mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/backend/users', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
        },
      });

      const response = await forward(request, 'POST', ['users']);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Invalid CSRF token');
    });

    it('should allow POST requests with valid CSRF token', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);

      vi.mocked(mockFetch).mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const request = new NextRequest('http://localhost:3000/api/backend/users', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await forward(request, 'POST', ['users']);
      expect(response.status).toBe(200);
    });

    it('should skip CSRF validation for GET requests', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf');
      
      vi.mocked(mockFetch).mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const request = new NextRequest('http://localhost:3000/api/backend/users', {
        method: 'GET',
      });

      await forward(request, 'GET', ['users']);
      
      // validateCsrfToken should not be called for GET
      expect(validateCsrfToken).not.toHaveBeenCalled();
    });

    it('should enforce CSRF validation for PUT requests', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf');
      vi.mocked(validateCsrfToken).mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/backend/users/1', {
        method: 'PUT',
        headers: {
          origin: 'http://localhost',
        },
      });

      const response = await forward(request, 'PUT', ['users', '1']);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Invalid CSRF token');
    });

    it('should enforce CSRF validation for PATCH requests', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf');
      vi.mocked(validateCsrfToken).mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/backend/users/1', {
        method: 'PATCH',
        headers: {
          origin: 'http://localhost',
        },
      });

      const response = await forward(request, 'PATCH', ['users', '1']);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Invalid CSRF token');
    });

    it('should enforce CSRF validation for DELETE requests', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf');
      vi.mocked(validateCsrfToken).mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/backend/users/1', {
        method: 'DELETE',
        headers: {
          origin: 'http://localhost',
        },
      });

      const response = await forward(request, 'DELETE', ['users', '1']);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Invalid CSRF token');
    });
  });

  describe('Origin Validation', () => {
    it('should reject POST requests without origin header', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend/users', {
        method: 'POST',
      });

      const response = await forward(request, 'POST', ['users']);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Origin required');
    });

    it('should reject POST requests from unauthorized origins', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend/users', {
        method: 'POST',
        headers: {
          origin: 'http://evil.com',
        },
      });

      const response = await forward(request, 'POST', ['users']);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Origin not allowed');
    });

    it('should accept POST requests from allowed origins', async () => {
      const { validateCsrfToken } = await import('@/lib/security/csrf');
      vi.mocked(validateCsrfToken).mockResolvedValue(true);

      vi.mocked(mockFetch).mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const request = new NextRequest('http://localhost:3000/api/backend/users', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await forward(request, 'POST', ['users']);
      expect(response.status).toBe(200);
    });

    it('should skip origin validation for GET requests', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      // GET request without origin should still work
      const request = new NextRequest('http://localhost:3000/api/backend/users', {
        method: 'GET',
      });

      const response = await forward(request, 'GET', ['users']);
      expect(response.status).toBe(200);
    });

    it('should handle invalid origin URLs', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend/users', {
        method: 'POST',
        headers: {
          origin: 'not-a-valid-url',
        },
      });

      const response = await forward(request, 'POST', ['users']);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid origin');
    });

    it('should reject PUT requests without origin header', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend/users/1', {
        method: 'PUT',
      });

      const response = await forward(request, 'PUT', ['users', '1']);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Origin required');
    });

    it('should reject PATCH requests from unauthorized origins', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend/users/1', {
        method: 'PATCH',
        headers: {
          origin: 'http://evil.com',
        },
      });

      const response = await forward(request, 'PATCH', ['users', '1']);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Origin not allowed');
    });

    it('should reject DELETE requests from unauthorized origins', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend/users/1', {
        method: 'DELETE',
        headers: {
          origin: 'http://evil.com',
        },
      });

      const response = await forward(request, 'DELETE', ['users', '1']);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Origin not allowed');
    });
  });

  describe('Path Validation', () => {
    it('should reject requests with missing path', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend', {
        method: 'GET',
      });

      const response = await forward(request, 'GET', []);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Missing path');
    });

    it('should reject requests with query parameters in path segments', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend/users', {
        method: 'GET',
      });

      // Simulate path segment containing query parameter (defense in depth)
      const response = await forward(request, 'GET', ['users?admin=true']);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid path format');
    });

    it('should reject requests with fragment identifiers in path segments', async () => {
      const request = new NextRequest('http://localhost:3000/api/backend/users', {
        method: 'GET',
      });

      // Simulate path segment containing fragment (defense in depth)
      const response = await forward(request, 'GET', ['users#section']);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid path format');
    });

    it('should accept valid path segments', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const request = new NextRequest('http://localhost:3000/api/backend/users/123', {
        method: 'GET',
      });

      const response = await forward(request, 'GET', ['users', '123']);
      expect(response.status).toBe(200);
    });
  });
});
